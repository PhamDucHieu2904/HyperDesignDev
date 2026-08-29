# Hieu Pham — static portfolio

Website tĩnh HTML/CSS/JavaScript. Không cần backend, database, Cloudflare Worker,
Next.js hay Node.js khi **xem website**. React chỉ chạy trong trình duyệt để giữ
các tương tác của giao diện Caelestia hiện tại.

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
với URL file/GitHub subpath và preview HTTP; không phải kiểm thử bố cục bằng trình duyệt thật.

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

Đã bỏ bộ khung server, xác thực ChatGPT, D1/Drizzle và cấu hình Sites không được
giao diện này sử dụng. Các file cũ đã theo dõi vẫn có thể lấy lại trong lịch sử Git.
Việc đổi source không tắt hay thay đổi website đã triển khai trước đây.
Tài nguyên gốc và giấy phép được giữ trong `public/CAELESTIA-LICENSE.txt`.
