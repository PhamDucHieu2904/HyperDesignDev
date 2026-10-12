# Hyper D² — profile và admin

Repository chứa trang profile và trang quản trị nội dung, dùng chung contracts,
schema và migration database. Hai giao diện có bundle, Worker và cách triển khai riêng.

Bản profile tĩnh vẫn là HTML/CSS/JavaScript, mở trực tiếp mà không cần backend,
database, Cloudflare Worker, Next.js hay Node.js khi **xem website**. React chạy
trong trình duyệt để giữ các tương tác của giao diện Caelestia hiện tại. Bản profile
Cloudflare dùng thêm public API để đọc nội dung đã xuất bản từ D1/R2.

## Cấu trúc chung

```text
app/                     Giao diện profile hiện có
app/admin/               Giao diện admin
workers/public/          Public API, media đã xuất bản và profile assets
workers/admin/           Admin API và assets, có xác thực Cloudflare Access
shared/contracts/        Cấu trúc dữ liệu và validation dùng chung
db/                      Một bộ migration và seed chính thức
dist/public/             Bản triển khai Cloudflare của profile
dist/admin/              Bản triển khai admin
```

Giữ nguyên đường dẫn source profile để tránh thay đổi import, CSS và tài nguyên.
Admin được đưa vào repository này từ `AdministratorHyperDesignDev`; hướng dẫn
chạy và dữ liệu local ở [workers/admin/README.md](workers/admin/README.md).

```sh
npm run build:all
npm test
```

`build:all` dựng cả hai bản Cloudflare. `npm run build` vẫn chỉ dựng profile tĩnh;
`npm run build:admin` chỉ dựng admin. Các lệnh build không triển khai website.

Portfolio Quencha Beverage đã được thêm làm bài Brand đầu tiên theo template
được cung cấp, với thumbnail lon dưa hấu. Nội dung có trong bản tĩnh và đã được
nhập vào dữ liệu local của profile/admin. Xem [hướng dẫn nội dung](db/content/README.md)
để cập nhật bài hoặc nhập lại trên máy mới; dữ liệu remote chưa được thay đổi.

## Mở ngay trên Windows

Nhấp đúp **`Mo-Website.bat`** hoặc **`index.html`** tại thư mục gốc.
Không cần cài Node/npm, không tải thư viện từ CDN, không mở cổng localhost.
File BAT dùng thư mục của chính nó nên có thể chạy từ shortcut hoặc nơi khác.

Giữ các mục sau cùng nhau khi sao chép website sang máy khác hoặc lên hosting:

```text
index.html          HTML đã dựng sẵn, mở trực tiếp được
assets/             JavaScript và CSS đã build
public/             Ảnh, font, GIF, ảnh chia sẻ và giấy phép
.nojekyll           Tắt xử lý Jekyll trên GitHub Pages
Mo-Website.bat      Mở index.html bằng trình duyệt mặc định trên Windows
```

Không chỉ sao chép mỗi `index.html`: trang cần cả `assets/` và `public/`.
Các đường dẫn đều tương đối, dùng được với `file://`, tên miền riêng và
`https://TEN-USER.github.io/TEN-REPO/`.

## Sửa nội dung và build lại

Chỉ người sửa source mới cần Node.js >=22.13.0:

```sh
npm ci
npm run build
npm test
```

- `app/page.tsx`: nội dung và tương tác.
- `app/desktop/DesktopViewport.tsx` và `viewport.ts`: scale toàn bộ bố cục PC theo canvas tối thiểu 1920 × 1000; giữ tỷ lệ chữ, nút, thanh bên và khoảng cách khi cửa sổ nhỏ.
- `app/project-launcher/`: cửa sổ New Project, validation và adapter gửi form.
- `app/project-launcher/config.ts`: endpoint Formspree công khai (để trống thì UI báo `not-configured`, không giả lập thành công).
- `app/globals.css`: giao diện và responsive.
- `site.config.mjs`: tiêu đề, mô tả và URL xuất bản.
- `public/`: tài nguyên gốc.
- `scripts/build.mjs`: tạo `index.html`, `assets/app.js`, `assets/app.css`.

HTML được dựng sẵn **một lần khi build**, không render bằng server khi khách truy cập.
JavaScript được đóng gói thành script thông thường để mở bằng `file://` mà không
vướng yêu cầu HTTP của ES modules. Ảnh và font tải từ các tệp đi kèm.

Sau khi sửa source, chạy build rồi refresh trang. `index.html` và `assets/` là
kết quả build, được đưa vào Git để GitHub Pages dùng trực tiếp. Đừng sửa tay các
file sinh ra vì build tiếp theo sẽ ghi đè.

`npm run dev` là lựa chọn **không bắt buộc**: build lại khi source đổi và cung cấp
preview tại `http://127.0.0.1:3000`; refresh trình duyệt để thấy thay đổi.
`npm start` chỉ phục vụ các tệp đã build. Ctrl+C để dừng preview.
`npm run check` kiểm tra TypeScript và import thừa; `npm run lint` là alias tương thích.
`npm test` kiểm tra HTML, tài nguyên, metadata, các tương tác trong DOM mô phỏng
với URL file/GitHub subpath và preview HTTP, cùng contracts/API admin, publish/unpublish
qua database dùng chung và sự tách biệt của hai bản triển khai. Các test DOM không
thay thế kiểm thử bố cục bằng trình duyệt thật.

Các breakpoint bố cục dùng `@container desktop` theo kích thước canvas trước khi
scale. Vì vậy laptop nhỏ giữ các cột của bản PC; màn hình điện thoại vẫn dùng
bố cục responsive. Các query về pointer, hover và reduced motion vẫn theo thiết bị.

### Bật nhận yêu cầu Project Launcher

Tạo một form và kích hoạt inbox trong Formspree, sau đó ghi endpoint dạng
`https://formspree.io/f/FORM_ID` vào `app/project-launcher/config.ts` rồi chạy lại
`npm run build`. Endpoint là thông tin công khai cần có trong bundle tĩnh; không đặt
API key riêng tư trong frontend. Form gửi JSON, có trường `_gotcha` chống bot và chỉ
hiện trạng thái thành công khi provider trả về HTTP success với phản hồi JSON.

## Đưa lên GitHub Pages

1. Build bản mới nếu đã sửa source.
2. Push repository, bao gồm `index.html`, `assets/`, `public/`, `.nojekyll`.
   Không đưa `node_modules/`, file `.env`, khóa bí mật hoặc thông tin riêng tư lên Git.
3. Trong repository mở **Settings → Pages → Build and deployment**.
4. Chọn **Deploy from a branch**, chọn nhánh bạn vừa push và thư mục **/(root)**,
   rồi Save. Không cần GitHub Actions để build bản đã sinh sẵn này.
5. Đợi GitHub Pages hoàn tất và mở URL GitHub hiển thị.

Push code riêng lẻ chưa tự bật website nếu Pages chưa được cấu hình.
Chưa có thao tác push hay xuất bản nào được thực hiện tự động bởi dự án.
Nếu chỉ muốn xuất bản bản chạy, bạn có thể dùng repository riêng chỉ chứa các mục
trong phần “Mở ngay trên Windows”, rồi cấu hình Pages từ root của repository đó.

Hướng dẫn chính thức:
[Cấu hình nguồn GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Tên miền và ảnh khi chia sẻ

Khi biết URL thật, điền `siteUrl` trong `site.config.mjs`, ví dụ
`https://TEN-USER.github.io/TEN-REPO/` hoặc `https://cv.tenmiencuaban.com/`, rồi build
và push lại. Thao tác này tạo canonical và URL tuyệt đối cho ảnh Open Graph/X.
Không cần đổi đường dẫn tài nguyên khi đổi tên miền. Khi `siteUrl` trống, không
tạo canonical giả; ảnh chia sẻ dùng đường dẫn tương đối và nên cấu hình URL thật
trước khi chia sẻ lên mạng xã hội.

Gắn domain bằng **Settings → Pages → Custom domain** và cấu hình DNS tại nơi mua
domain theo [hướng dẫn GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
Đặt `siteUrl` không tự cấu hình DNS hoặc mua domain. Nếu GitHub tạo `CNAME` trong
repository, giữ file đó; build không ghi đè hay xóa nó.

## Phạm vi hiện tại

Giữ nguyên giao diện desktop Caelestia: launcher, tìm ứng dụng, workspace,
dashboard, cửa sổ terminal/files, trạng thái Play/Pause và popup.
Thời tiết, CPU/RAM, danh sách nhạc và tệp là **dữ liệu mô phỏng**.
Chưa có âm thanh thật hay file `Resume.pdf` để tải; chuyển sang tĩnh không tự tạo
CV hoặc thêm chức năng tải CV. Có thể bổ sung PDF thật và link tương đối sau.

Profile tĩnh không cần server. Public Worker và Admin Worker dùng chung D1/R2
trên staging; admin giữ xác thực Cloudflare Access, kiểm tra identity và CSRF.
Việc gom mã nguồn không tự triển khai hoặc thay đổi website đang chạy.
Tài nguyên gốc và giấy phép được giữ trong `public/CAELESTIA-LICENSE.txt`.
