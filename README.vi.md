# Antigravity subagent (bản tiếng Việt)

Giao **một việc trọn gói** cho Google Antigravity, dùng đúng tài khoản và cài
đặt sẵn có của nó. Không cần dán API key: chỉ cần đăng nhập `agy` một lần.

Có 2 cách dùng:

## 1. Cho mọi AI agent (Codex, Claude Code, Qoder, Cursor…)

```bash
git clone https://github.com/kimducanh27-cpu/antigravity-subagent.git
cd antigravity-subagent
node scripts/agy-task.mjs "Trả lời đúng một dòng: xin chào từ Antigravity"
```

- Câu trả lời in ra **stdout**; lỗi in ra **stderr**.
- Mã thoát: `0` thành công, `1` lỗi/không có câu trả lời, `2` sai cách dùng,
  `124` quá thời gian.
- Việc giao phải **tự chứa đủ thông tin** (Antigravity không thấy hội thoại của
  bạn). Ghi rõ đường dẫn, yêu cầu, định dạng kết quả.
- Tùy chọn: `--cwd <thư mục>`, `--model <tên>`, `--effort <mức>`,
  `--agent <tên>`, `--timeout <giây>`.

Ví dụ:

```bash
node scripts/agy-task.mjs --cwd . --timeout 600 \
  "Kiểm tra src/cache.ts xem có lỗi logic không. Chỉ báo lỗi kèm file:dòng, không sửa file."
```

## 2. Cho DeepSeek Harness

1. Clone repo về máy.
2. Mở **Plugins → Add plugin**, nhập đường dẫn tuyệt đối tới thư mục vừa clone
   (hoặc gọi `plugin_manager install_bundle <đường dẫn>`).
3. Bật **Antigravity subagent** trong **Plugins → Installed plugins**.
4. Trong chat, nhờ agent dùng tool `subagent_antigravity`:

   ```text
   subagent_antigravity({ description: "Soát cache", prompt: "Soát src/cache.ts, chỉ báo lỗi." })
   ```

Mỗi lần gọi là một việc độc lập; không chat tiếp với việc đó được. Kết quả về
qua thông báo hoàn thành.

## Yêu cầu & bảo mật

- Cài Antigravity CLI (`agy --version` chạy được) và đăng nhập một lần.
- Mặc định tôn trọng quyền trong `~/.gemini/antigravity-cli/settings.json`.
- Chỉ bật `--bypass-permissions` (hoặc `permissionMode: bypass`) khi thật sự tin
  tưởng, vì nó tự đồng ý mọi thao tác ghi file/chạy lệnh.
- Đây là tích hợp không chính thức; Antigravity thuộc Google, DeepSeek Harness
  thuộc DeepSeek.

Chi tiết đầy đủ (tiếng Anh): [README.md](README.md) và [AGENTS.md](AGENTS.md).
