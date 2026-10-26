using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace EaRemoteHelper
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        static extern bool GetCursorPos(out Point lpPoint);

        [DllImport("user32.dll")]
        static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool SetThreadDesktop(IntPtr hDesktop);

        [DllImport("user32.dll")]
        static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll")]
        static extern short VkKeyScan(char ch);

        [DllImport("user32.dll")]
        static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [StructLayout(LayoutKind.Sequential)]
        struct INPUT
        {
            public uint type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        const uint INPUT_KEYBOARD = 1;
        const uint KEYEVENTF_UNICODE = 0x0004;
        const uint KEYEVENTF_KEYUP = 0x0002;

        const int SM_CXSCREEN = 0;
        const int SM_CYSCREEN = 1;

        const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        const uint MOUSEEVENTF_LEFTUP = 0x0004;
        const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        const uint MOUSEEVENTF_WHEEL = 0x0800;

        static ImageCodecInfo jpegCodec;
        static EncoderParameters encoderParams;

        static Dictionary<string, byte> vkMap = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase)
        {
            { "ESC", 0x1B },
            { "TAB", 0x09 },
            { "ENTER", 0x0D },
            { "BS", 0x08 },
            { "DEL", 0x2E },
            { "SPACE", 0x20 },
            { "UP", 0x26 },
            { "DOWN", 0x28 },
            { "LEFT", 0x25 },
            { "RIGHT", 0x27 },
            { "HOME", 0x24 },
            { "END", 0x23 },
            { "PGUP", 0x21 },
            { "PGDN", 0x22 },
            { "HANGUL", 0x15 },
            { "F1", 0x70 }, { "F2", 0x71 }, { "F3", 0x72 }, { "F4", 0x73 },
            { "F5", 0x74 }, { "F6", 0x75 }, { "F7", 0x76 }, { "F8", 0x77 },
            { "F9", 0x78 }, { "F10", 0x79 }, { "F11", 0x7A }, { "F12", 0x7B }
        };

        static void AttachDefaultDesktop()
        {
            IntPtr hDesk = OpenInputDesktop(0, false, 0x01FF);
            if (hDesk == IntPtr.Zero)
            {
                hDesk = OpenDesktop("Default", 0, false, 0x01FF);
            }
            if (hDesk != IntPtr.Zero)
            {
                SetThreadDesktop(hDesk);
            }
        }

        static void Main(string[] args)
        {
            Console.InputEncoding = Encoding.UTF8;
            Console.OutputEncoding = Encoding.UTF8;

            // Fresh MTA thread without any prior user32 hooks so SetThreadDesktop succeeds 100%!
            var worker = new Thread(WorkerLoop);
            worker.Start();
            worker.Join();
        }

        static void WorkerLoop()
        {
            AttachDefaultDesktop();
            SetProcessDPIAware();

            foreach (var codec in ImageCodecInfo.GetImageEncoders())
            {
                if (codec.MimeType == "image/jpeg")
                {
                    jpegCodec = codec;
                    break;
                }
            }
            encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 62L);

            var serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

            string line;
            while ((line = Console.ReadLine()) != null)
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                int id = 0;
                try
                {
                    var req = serializer.Deserialize<Dictionary<string, object>>(line);
                    if (req.ContainsKey("id")) id = Convert.ToInt32(req["id"]);
                    string type = req.ContainsKey("type") ? Convert.ToString(req["type"]) : "";

                    int w = GetSystemMetrics(SM_CXSCREEN);
                    int h = GetSystemMetrics(SM_CYSCREEN);
                    if (w <= 0) w = 1920;
                    if (h <= 0) h = 1080;

                    if (type == "frame")
                    {
                        int targetW = (int)(w * 0.72);
                        int targetH = (int)(h * 0.72);

                        Point cursorPt;
                        GetCursorPos(out cursorPt);

                        using (var bmp = new Bitmap(w, h))
                        {
                            using (var g = Graphics.FromImage(bmp))
                            {
                                g.CopyFromScreen(0, 0, 0, 0, new Size(w, h), CopyPixelOperation.SourceCopy);

                                // Draw cursor pointer clearly on screen
                                int cx = cursorPt.X;
                                int cy = cursorPt.Y;
                                Point[] arrow = new Point[]
                                {
                                    new Point(cx, cy),
                                    new Point(cx, cy + 18),
                                    new Point(cx + 5, cy + 14),
                                    new Point(cx + 9, cy + 22),
                                    new Point(cx + 12, cy + 20),
                                    new Point(cx + 8, cy + 12),
                                    new Point(cx + 14, cy + 12)
                                };
                                using (var fillBrush = new SolidBrush(Color.FromArgb(245, 255, 255, 255)))
                                using (var borderPen = new Pen(Color.FromArgb(239, 68, 68), 2f))
                                {
                                    g.SmoothingMode = SmoothingMode.AntiAlias;
                                    g.FillPolygon(fillBrush, arrow);
                                    g.DrawPolygon(borderPen, arrow);
                                }
                            }
                            using (var resized = new Bitmap(targetW, targetH))
                            {
                                using (var g2 = Graphics.FromImage(resized))
                                {
                                    g2.InterpolationMode = InterpolationMode.Bilinear;
                                    g2.DrawImage(bmp, 0, 0, targetW, targetH);
                                }
                                using (var ms = new MemoryStream())
                                {
                                    resized.Save(ms, jpegCodec, encoderParams);
                                    string b64 = Convert.ToBase64String(ms.ToArray());
                                    Console.WriteLine(serializer.Serialize(new
                                    {
                                        id = id,
                                        ok = true,
                                        width = w,
                                        height = h,
                                        cursorX = cursorPt.X,
                                        cursorY = cursorPt.Y,
                                        image = b64
                                    }));
                                }
                            }
                        }
                    }
                    else if (type == "mouse")
                    {
                        string button = req.ContainsKey("button") ? Convert.ToString(req["button"]) : "left";
                        Point cur;
                        GetCursorPos(out cur);

                        int x = cur.X;
                        int y = cur.Y;

                        if (req.ContainsKey("dx") || req.ContainsKey("dy"))
                        {
                            int dx = req.ContainsKey("dx") && req["dx"] != null ? Convert.ToInt32(req["dx"]) : 0;
                            int dy = req.ContainsKey("dy") && req["dy"] != null ? Convert.ToInt32(req["dy"]) : 0;
                            x = Math.Max(0, Math.Min(w - 1, cur.X + dx));
                            y = Math.Max(0, Math.Min(h - 1, cur.Y + dy));
                            SetCursorPos(x, y);
                        }
                        else if (req.ContainsKey("rx") && req.ContainsKey("ry") && req["rx"] != null && req["ry"] != null)
                        {
                            double rx = Convert.ToDouble(req["rx"]);
                            double ry = Convert.ToDouble(req["ry"]);
                            x = Math.Max(0, Math.Min(w - 1, (int)(rx * w)));
                            y = Math.Max(0, Math.Min(h - 1, (int)(ry * h)));
                            SetCursorPos(x, y);
                        }

                        if (button == "move")
                        {
                            // Cursor moved only
                        }
                        else if (button == "scroll")
                        {
                            int delta = req.ContainsKey("delta") ? Convert.ToInt32(req["delta"]) : 0;
                            mouse_event(MOUSEEVENTF_WHEEL, x, y, delta, 0);
                        }
                        else if (button == "right")
                        {
                            mouse_event(MOUSEEVENTF_RIGHTDOWN, x, y, 0, 0);
                            mouse_event(MOUSEEVENTF_RIGHTUP, x, y, 0, 0);
                        }
                        else if (button == "left" || button == "double")
                        {
                            mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, 0);
                            mouse_event(MOUSEEVENTF_LEFTUP, x, y, 0, 0);
                            if (button == "double")
                            {
                                Thread.Sleep(40);
                                mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, 0);
                                mouse_event(MOUSEEVENTF_LEFTUP, x, y, 0, 0);
                            }
                        }
                        Console.WriteLine(serializer.Serialize(new { id = id, ok = true, x = x, y = y }));
                    }
                    else if (type == "key")
                    {
                        bool ctrl = req.ContainsKey("ctrl") && Convert.ToBoolean(req["ctrl"]);
                        bool alt = req.ContainsKey("alt") && Convert.ToBoolean(req["alt"]);
                        bool shift = req.ContainsKey("shift") && Convert.ToBoolean(req["shift"]);
                        bool win = req.ContainsKey("win") && Convert.ToBoolean(req["win"]);
                        string special = req.ContainsKey("special") ? Convert.ToString(req["special"]) : "";
                        string text = req.ContainsKey("text") ? Convert.ToString(req["text"]) : "";

                        if (!string.IsNullOrEmpty(special) && vkMap.ContainsKey(special))
                        {
                            PressKey(vkMap[special], ctrl, alt, shift, win);
                        }
                        else if (special == "WIN")
                        {
                            PressKey(0x5B, false, false, false, false);
                        }
                        else if (!string.IsNullOrEmpty(text))
                        {
                            if ((ctrl || alt || win) && text.Length == 1)
                            {
                                char ch = char.ToUpperInvariant(text[0]);
                                PressKey((byte)ch, ctrl, alt, shift, win);
                            }
                            else
                            {
                                SendUnicodeString(text);
                            }
                        }
                        Console.WriteLine(serializer.Serialize(new { id = id, ok = true }));
                    }
                    else
                    {
                        Console.WriteLine(serializer.Serialize(new { id = id, ok = false, error = "Unknown type" }));
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine(serializer.Serialize(new { id = id, ok = false, error = ex.Message }));
                }
            }
        }

        static void SendUnicodeString(string text)
        {
            var inputs = new List<INPUT>();
            foreach (char c in text)
            {
                var down = new INPUT { type = INPUT_KEYBOARD };
                down.u.ki.wVk = 0;
                down.u.ki.wScan = c;
                down.u.ki.dwFlags = KEYEVENTF_UNICODE;
                inputs.Add(down);

                var up = new INPUT { type = INPUT_KEYBOARD };
                up.u.ki.wVk = 0;
                up.u.ki.wScan = c;
                up.u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                inputs.Add(up);
            }
            if (inputs.Count > 0)
            {
                var arr = inputs.ToArray();
                SendInput((uint)arr.Length, arr, Marshal.SizeOf(typeof(INPUT)));
            }
        }

        static void PressKey(byte vk, bool ctrl, bool alt, bool shift, bool win)
        {
            if (ctrl) keybd_event(0x11, 0, 0, 0);
            if (alt) keybd_event(0x12, 0, 0, 0);
            if (shift) keybd_event(0x10, 0, 0, 0);
            if (win) keybd_event(0x5B, 0, 0, 0);

            keybd_event(vk, 0, 0, 0);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);

            if (win) keybd_event(0x5B, 0, KEYEVENTF_KEYUP, 0);
            if (shift) keybd_event(0x10, 0, KEYEVENTF_KEYUP, 0);
            if (alt) keybd_event(0x12, 0, KEYEVENTF_KEYUP, 0);
            if (ctrl) keybd_event(0x11, 0, KEYEVENTF_KEYUP, 0);
        }
    }
}
