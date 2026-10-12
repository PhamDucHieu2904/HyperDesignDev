# Hyper D² Admin trong repository chung

Giao diện và API admin được chuyển từ `AdministratorHyperDesignDev` vào repository
`HyperDesignDev`. Source giao diện nằm ở `app/admin/`; Worker ở `workers/admin/src/`.
Profile giữ nguyên source, CSS, tài nguyên và lệnh build trước đây.

## Chạy admin

Từ thư mục gốc repository:

```powershell
npm ci
npm run admin
```

Mở `http://127.0.0.1:8788`. Lệnh `admin` build giao diện rồi chạy Worker local.
Port 8788 và inspector port 9230 cho phép chạy cùng Public Worker (port mặc định 8787).
Profile tĩnh vẫn có thể mở bằng `Mo-Website.bat` hoặc `npm run dev` trên port 3000.

Máy mới cần tạo cấu hình local trước khi chạy:

```powershell
Copy-Item workers/admin/.dev.vars.example workers/admin/.dev.vars
npm run cf:local:migrate:admin
npm run cf:local:seed:admin
```

`.dev.vars` được Git bỏ qua. Local bypass chỉ có hiệu lực khi `DEPLOY_ENV=local`;
không triển khai các biến bypass hoặc thông tin xác thực local lên staging/production.

## Dữ liệu và tài nguyên

- `shared/contracts/portfolio.ts` và `admin.ts` là nguồn contracts chung.
- `db/migrations/` là nguồn migration duy nhất; không duy trì bản sao cho admin.
- `db/seeds/portfolio-seed.sql` dùng chung và giữ tính idempotent.
- Media seed lấy từ bốn tệp hiện có trong `public/`, không sao chép thêm `seed-media/`.
- Build admin chỉ đóng gói HTML, JS, CSS, headers và font Google Sans Flex cần cho giao diện.

Trong lần gom project này, cấu hình `.dev.vars` và 24 tệp dữ liệu local cũ đã được
sao chép, kiểm tra checksum và giữ riêng tại `.wrangler/admin/state/`. Dữ liệu local
profile tiếp tục ở `.wrangler/state/`. Hai database local vẫn độc lập như trước;
thay đổi local admin không tự xuất hiện trong local profile. Các lệnh seed/migrate
admin luôn nhắm vào vùng admin, không thay thế dữ liệu local profile.

Trên staging, hai Worker vẫn dùng chung `hyperd-content-staging` và
`hyperd-media-staging`. Admin lưu draft và xuất bản revision; public chỉ phục vụ
nội dung và media có tham chiếu từ revision đã xuất bản.

Thư mục admin cũ được giữ nguyên để đối chiếu/khôi phục, gồm các backup staging
trong `AdministratorHyperDesignDev/backups/`. Source mới không phụ thuộc vào
thư mục cũ khi build hoặc chạy. Không chạy đồng thời hai bản admin cũ/mới trên
cùng một vùng local state.

## Kiểm tra và triển khai

```powershell
npm run build:all
npm test
```

`npm run test:admin` chạy contracts và API admin, gồm kiểm tra publish qua Public
Worker với database và kho media giả lập chung. `npm run test:isolation` kiểm tra
hai bản build đã có trong `dist/`. `npm run check` kiểm tra TypeScript của cả hai phần.

`workers/admin/wrangler.jsonc` giữ nguyên tên Worker, D1/R2 bindings và cấu hình
Cloudflare Access của bản admin trước khi chuyển. Authentication, kiểm tra owner,
Origin, CSRF và cơ chế không cache admin được giữ nguyên.

Việc build hoặc chạy local không triển khai, không chạy remote migration và không
ghi vào D1/R2 staging. Khi chủ động triển khai sau này, build từng phần rồi dùng
Wrangler config tương ứng; không upload source repository như bộ assets của website.
