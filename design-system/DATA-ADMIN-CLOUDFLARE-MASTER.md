# Hyper D — Master Database, Cloudflare & Admin

Ngày lập: 2026-09-11. Trạng thái: kế hoạch triển khai; chưa tạo database, tài nguyên Cloudflare hoặc web admin.

Tài liệu này chốt phạm vi dữ liệu và luồng quản trị cho các task kế tiếp. Các quyết định dưới đây ưu tiên hơn những phần data tĩnh trong PORTFOLIO-MASTER.md; bố cục Hyper D đã được duyệt vẫn được giữ. Snippet là thiết kế để triển khai và kiểm chứng, không phải mã production đã chạy.

## 1. Mục tiêu sản phẩm đã thống nhất

Hyper D là thương hiệu cá nhân dùng lâu dài, thường xuyên thêm/sửa/xóa sản phẩm. Chủ website cần tự quản lý nội dung mà không phải sửa code hoặc push Git mỗi lần đăng bài.

Ba thành phần có trách nhiệm khác nhau:

| Thành phần | Trách nhiệm |
| --- | --- |
| Hyper D public | Giao diện cho khách: duyệt portfolio, tìm kiếm, xem bài, CV và các phần giới thiệu. |
| Hyper D Admin | Giao diện dành cho chủ website: CRUD dữ liệu, upload media, soạn bài và xuất bản. Admin cũng là một frontend. |
| Backend | Workers API xác thực quyền, kiểm tra dữ liệu, đọc/ghi D1 và R2, quyết định dữ liệu nào được công khai. |

Admin không sửa layout toàn website: không kéo thả sidebar, đổi vị trí X, thay các theme, sửa bố cục CV hoặc hệ điều hướng. Admin được thiết kế phần nội dung bên trong từng bài portfolio: ảnh, chữ, nhóm cột, khoảng cách, nền section và thứ tự trình bày.

Luồng cốt lõi phải đúng ý người dùng:

1. Add project → chọn Design/Development → chọn category → thumbnail → title → subtitle.
2. Save tạo một card trong thư viện admin; body ban đầu rỗng.
3. Bấm thumbnail/card → vào trình biên tập bài của sản phẩm đó.
4. Thêm ảnh, text, gallery, section; sắp xếp và xem trước desktop/mobile.
5. Save draft lưu công việc. Publish đưa phiên bản đã chọn lên Hyper D.
6. Có thể Publish card khi body rỗng. Khách mở bài sẽ thấy title/subtitle và thông báo tiếng Anh `Content is being prepared.`; không lỗi, không tự bịa nội dung.
7. Sửa một bài đã public không làm bản đang public thay đổi cho tới khi Publish lại.

Phân biệt rõ: Save draft chỉ lưu ở admin; Publish mới cập nhật web công khai. Sau Publish không cần rebuild hoặc Git push.

## 2. Hiện trạng repo và điểm cần chuyển đổi

Repo: `D:/program project/HyperDesignDev`.

| File hiện tại | Quan sát / thay đổi kế tiếp |
| --- | --- |
| `package.json` | React 19, TypeScript, esbuild; chưa có backend/framework server. Giữ nền này, chưa cần rewrite Next.js. |
| `scripts/build.mjs` | Build HTML tại root và assets; dùng script IIFE để hỗ trợ file://. Cần thêm output deploy được giới hạn rõ. |
| `app/portfolio/data.ts` | Dữ liệu bài và đường dẫn ảnh đang import tĩnh; dùng làm seed migration. |
| `app/portfolio/types.ts` | Một PortfolioProject chứa thumbnail, cover, metadata, sections; tách thành summary và detail. |
| `app/portfolio/PortfolioApp.tsx` | Đọc trực tiếp array đồng bộ; initialCategory và next cũng phụ thuộc array. Cần chuyển sang repository bất đồng bộ. |
| `app/portfolio/selectors.ts` | Search toàn bộ array, lọc category, sort order; chuyển việc này sang public API khi dùng cloud. |
| `app/portfolio/navigation.ts` | Giữ All là overview, category mở thẳng bài đầu; bổ sung loading/error khi bài chưa tải. |
| `app/page.tsx` | CV/facts/experience/stack hiện hardcode. Quản lý dữ liệu CV là phase sau, không trộn vào MVP portfolio. |
| `site.config.mjs` | siteUrl đang rỗng; phải điền URL deploy thật khi kết nối. |
| `tests/rendered-html.test.mjs` | Test static hiện cấm API fetch; giữ test offline và thêm chế độ cloud, không xóa kiểm tra cũ. |

Không thấy cấu hình Wrangler hoặc workflow GitHub trong audit này. Không giả định đã có tài khoản, domain, DB hay subscription R2 được kết nối.

Các ID category cần giữ ổn định:

| ID lưu DB | Nhãn trên Hyper D | Nhóm | Thứ tự |
| --- | --- | --- | --- |
| illustrator | Brand | design | 10 |
| photoshop | Visual | design | 20 |
| blender | 3D | design | 30 |
| game | Game | development | 40 |
| web | Web | development | 50 |
| app | App | development | 60 |

`all` là filter, không phải một category DB. Một project có một category chính; tags/tools có thể nhiều. Đổi tên hiển thị không đổi ID, và không tự suy ra category từ tên phần mềm.

## 3. Kiến trúc đề xuất và nơi lưu dữ liệu

Chọn một repo để quản lý source cho dễ chia sẻ types và renderer; build/deploy thành hai ứng dụng độc lập. Không cần tách repo chỉ để làm web nhẹ. Độ nhẹ phụ thuộc dữ liệu browser tải, không phải tổng kích thước source repo.

```text
Khách → Hyper D public Worker + static assets
                    ├─ GET /api/v1/* → D1: chỉ published snapshot
                    └─ GET /media/*  → R2: chỉ media đã được cấp public

Chủ website → Cloudflare Access → Admin Worker + static admin
                                      ├─ /api/admin/* → D1 CRUD/revisions
                                      └─ upload/preview → R2 private

GitHub → source, migrations, deploy code
Admin Publish → D1 snapshot/pointer → Hyper D đọc qua API
```

Nguồn dữ liệu production duy nhất là D1 + R2. GitHub không giữ database đang vận hành, ảnh upload mới hoặc secrets. Vẫn giữ asset giao diện như font/logo/wallpaper trong source nếu phù hợp.

Đề xuất triển khai:

- Public Worker: phục vụ Hyper D, public GET API, media công khai.
- Admin Worker: toàn bộ hostname được Access bảo vệ; static admin và API cùng origin.
- Một D1 cho mỗi môi trường; cả hai Worker của môi trường dùng chung DB đó.
- Một R2 bucket private cho mỗi môi trường; cả hai Worker có binding. Không bật public toàn bucket vì chứa cả ảnh draft.
- Ban đầu dùng địa chỉ workers.dev được Cloudflare cấp. Custom domain có thể gắn sau; tên domain riêng không được coi là miễn phí.
- Có thể giữ GitHub Pages trong giai đoạn chuyển tiếp: public frontend gọi API Worker qua HTTPS với CORS chỉ cho origin thật. Ưu tiên cuối cùng cùng-origin trên Cloudflare để đơn giản cấu hình.

D1 phù hợp metadata và nội dung có cấu trúc; ảnh/video binary đi R2. D1 binding và R2 binding nằm ở Worker, không được đưa thông tin quản trị cloud vào frontend. [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/), [D1](https://developers.cloudflare.com/d1/).

## 4. Miễn phí: giới hạn cần biết

Thông tin kiểm tra theo tài liệu chính thức ngày lập. Đây là quota nhà cung cấp, khác với giới hạn upload do ứng dụng tự đặt.

| Dịch vụ | Mức miễn phí liên quan |
| --- | --- |
| D1 | 5 triệu rows read/ngày; 100.000 rows written/ngày; tổng storage 5 GB. Một database Free tối đa 500 MB. |
| Workers Free | 100.000 request Worker/ngày; CPU hạn chế, không dùng Worker Free để xử lý ảnh nặng. |
| R2 Standard | 10 GB-month storage; 1 triệu Class A và 10 triệu Class B operations/tháng; không tính phí egress trực tiếp từ R2. |

D1 tính số dòng quét chứ không chỉ số dòng trả về. Khi chạm quota Free, query có thể thất bại; index và pagination là cần thiết. R2 là subscription có free allowance và có thể phát sinh phí khi vượt; lúc kích hoạt phải kiểm tra màn hình billing/payment của tài khoản, không hứa miễn phí vô hạn. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/).

Budget nội bộ ban đầu: cảnh báo ở 70% và 90% quota; theo dõi D1 storage, rows, R2 bytes và request. Cảnh báo không phải hard spending cap của Cloudflare. Không bật trả phí tự động do ứng dụng quyết định. Không thu thập analytics per-view vào DB ở MVP.

## 5. Thiết kế database

### 5.1 Nguyên tắc

- D1 theo SQLite; migration SQL có version và đưa vào Git.
- ID dùng UUID từ server; slug dùng URL, unique và ổn định. Seed giữ legacy ID khi cần mapping.
- Timestamp dùng UTC ISO 8601; UI hiển thị theo local timezone.
- JSON lưu document của bài, không lưu HTML tùy ý hay base64 media.
- Metadata bản nháp và bản public tách nhau; danh sách public tuyệt đối không đọc metadata draft.
- Revision immutable: Publish đổi con trỏ tới một revision, không sửa revision cũ.
- Dùng foreign keys, CHECK, unique index; validator backend kiểm tra cấu trúc JSON sâu.
- SQL dùng prepared statement/bind; không nối trực tiếp search/order/filter vào câu SQL.

### 5.2 Các bảng MVP

| Bảng | Nội dung |
| --- | --- |
| categories | Sáu category chuẩn, nhãn, nhóm, sort_order. MVP chỉ seed, chưa cho CRUD category. |
| projects | Identity, slug, soft-delete, bản nháp hiện tại, optimistic version. |
| project_revisions | Snapshot metadata + document; manual save/publish tạo revision để khôi phục. |
| public_projects | Projection phục vụ list/search, trỏ đúng revision public; không chứa draft. |
| media_assets | R2 key, mime, byte size, dimensions, upload state, metadata và soft-delete. |
| revision_assets | Các asset được mỗi revision tham chiếu; bảo vệ khỏi xóa nhầm. |
| draft_assets | Asset tham chiếu trong draft hiện tại, cập nhật khi save. |
| audit_events | Ai làm gì với bản ghi nào; không ghi token hoặc body bài đầy đủ. |

Schema nền dưới đây đầy đủ quan hệ chính, cần chạy thử với D1 local trước khi áp dụng remote:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  discipline TEXT NOT NULL CHECK(discipline IN ('design','development')),
  sort_order INTEGER NOT NULL UNIQUE
);
INSERT INTO categories VALUES
 ('illustrator','Brand','design',10), ('photoshop','Visual','design',20),
 ('blender','3D','design',30), ('game','Game','development',40),
 ('web','Web','development',50), ('app','App','development',60);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes >= 0),
  width INTEGER,
  height INTEGER,
  alt_default TEXT NOT NULL DEFAULT '',
  checksum TEXT,
  state TEXT NOT NULL CHECK(state IN ('pending','ready','failed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  draft_meta_json TEXT NOT NULL CHECK(json_valid(draft_meta_json)),
  draft_body_json TEXT NOT NULL CHECK(json_valid(draft_body_json)),
  draft_version INTEGER NOT NULL DEFAULT 1 CHECK(draft_version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE project_revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source_version INTEGER NOT NULL,
  meta_json TEXT NOT NULL CHECK(json_valid(meta_json)),
  body_json TEXT NOT NULL CHECK(json_valid(body_json)),
  schema_version INTEGER NOT NULL CHECK(schema_version >= 1),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, id)
);

CREATE TABLE public_projects (
  project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE RESTRICT,
  revision_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  title TEXT NOT NULL,
  short_title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  thumbnail_asset_id TEXT NOT NULL REFERENCES media_assets(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK(is_featured IN (0,1)),
  search_text TEXT NOT NULL,
  content_state TEXT NOT NULL CHECK(content_state IN ('empty','ready')),
  published_at TEXT NOT NULL,
  FOREIGN KEY(project_id, revision_id) REFERENCES project_revisions(project_id, id)
);
CREATE INDEX public_category_order ON public_projects(category_id, sort_order, project_id);
CREATE INDEX public_featured ON public_projects(is_featured, sort_order, project_id);
CREATE INDEX revision_history ON project_revisions(project_id, created_at DESC);
CREATE INDEX project_updated ON projects(updated_at DESC, id);

CREATE TABLE revision_assets (
  revision_id TEXT NOT NULL REFERENCES project_revisions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(revision_id, asset_id)
);
CREATE INDEX revision_asset_lookup ON revision_assets(asset_id);
CREATE TABLE draft_assets (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  PRIMARY KEY(project_id, asset_id)
);
CREATE INDEX draft_asset_lookup ON draft_assets(asset_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_sub TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detail_json)),
  created_at TEXT NOT NULL
);
CREATE INDEX audit_by_entity ON audit_events(entity_type, entity_id, created_at DESC);
```

Không lưu `discipline` lặp trên public_projects: join categories để lấy. `draft_meta_json` chứa categoryId, title, shortTitle, subtitle, thumbnailAssetId, tags, tools, role, year, coverAssetId tùy chọn, featured và sortOrder. Backend kiểm tra category tồn tại và mọi asset ready trước khi publish.

### 5.3 Quy tắc trạng thái và đồng thời

Trạng thái UI được suy ra: Draft = không có public_projects; Published = có projection; Unpublished changes = draft_version khác source_version của revision public; Trash = deleted_at có giá trị. Body empty là trạng thái nội dung, không phải permission.

Save draft yêu cầu expectedVersion. UPDATE chỉ khi version khớp; thành công tăng version, cập nhật draft_assets. Không khớp trả 409 để người dùng chọn tải lại hoặc giữ bản đang chỉnh. Không ghi đè âm thầm khi hai tab admin cùng sửa.

Publish nhận expectedVersion + requestId/idempotency key. Backend validate snapshot và media, sau đó atomically tạo revision, revision_assets, cập nhật public_projects và audit. Một lần Publish phải xuất hiện cả metadata và body cùng phiên bản. D1 batch hỗ trợ rollback khi một statement lỗi; zero rows affected không tự gây rollback, nên implementation phải có guard transaction thực sự (ví dụ constraint/trigger guard được test), không chỉ đọc version rồi ghi ở các request riêng. [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Unpublish xóa projection public trong giao dịch, giữ draft/revisions. Trash đồng thời unpublish + soft-delete. Restore chỉ khôi phục về draft, không tự public lại. Hard delete cần kiểm tra references và giữ thời gian phục hồi tối thiểu 30 ngày theo chính sách ứng dụng. MVP chưa tự dọn file hàng loạt.

Revision retention đề xuất: giữ 20 manual snapshots gần nhất, luôn giữ revision đang public; autosave chỉ cập nhật draft, không tạo revision mỗi phím gõ. Audit retention 90 ngày là cấu hình ứng dụng, kiểm tra dung lượng trước khi bật job cleanup.

## 6. Bài portfolio linh hoạt trong khung cố định

### 6.1 Document contract

Không dùng một template bắt buộc cho mọi sản phẩm. Dùng các block/section xếp được theo ý người soạn; bố cục responsive theo quy tắc renderer chung. Đây là content editor có layout trong bài, không phải website builder.

```ts
type ArticleDocument = {
  schemaVersion: 1;
  blocks: ArticleBlock[];
};
type BlockStyle = {
  width?: 'reading' | 'wide' | 'full';
  background?: 'transparent' | 'surface' | 'accent';
  accentColor?: string; // validated hex; chỉ tác động section
  padding?: 'none' | 'sm' | 'md' | 'lg';
};
type ArticleBlock =
  | { id: string; type: 'text'; style?: BlockStyle; paragraphs: RichParagraph[] }
  | { id: string; type: 'heading'; level: 2 | 3; text: string; style?: BlockStyle }
  | { id: string; type: 'image'; assetId: string; alt: string; caption?: string;
      fit: 'contain' | 'cover'; style?: BlockStyle }
  | { id: string; type: 'gallery'; items: { assetId: string; alt: string }[];
      columns: 2 | 3; style?: BlockStyle }
  | { id: string; type: 'columns'; columns: ArticleBlock[][]; style?: BlockStyle }
  | { id: string; type: 'video'; assetId: string; posterAssetId: string;
      caption?: string; style?: BlockStyle }
  | { id: string; type: 'links'; items: { label: string; url: string }[] }
  | { id: string; type: 'spacer'; size: 'sm' | 'md' | 'lg' };
type RichParagraph = {
  spans: { text: string; bold?: boolean; italic?: boolean; href?: string }[];
};
```

V1 không nhận raw HTML/CSS/JS/iframe. URL link chỉ http/https; validation đệ quy, tối đa 2 tầng columns, 3 cột và 200 block toàn bài. Max document JSON 512 KiB là giới hạn sản phẩm đề xuất. Server validate lại mọi dữ liệu, không tin validator browser.

Renderer dùng cùng source giữa Admin Preview và Hyper D: đảm bảo preview đúng phiên bản schema và fonts. Unknown block/schema không được làm crash cả trang; báo unsupported trong admin, dùng fallback có kiểm soát ở public. Không đổi field âm thầm; migration document phải có version.

### 6.2 Những gì được custom

| Được chỉnh trong bài | Giới hạn |
| --- | --- |
| Chèn/xóa/nhân bản/sắp xếp block | Drag và nút Move up/down; có undo/redo. |
| Text | Heading, đoạn, bold/italic/link, căn lề trong tập cho phép. Không bắt buộc bold hoặc tăng letter-spacing. |
| Ảnh | Width preset, crop focal point nếu triển khai, caption, alt, contain/cover. Mặc định artwork là contain. |
| Gallery/columns | Desktop 2–3 cột; mobile xếp dọc theo DOM. Không kéo absolute-position tự do. |
| Background/spacing | Token hoặc màu section được validate; không đổi palette shell. |
| Video | Controls, poster, preload none, không autoplay có tiếng. |

Header title/subtitle của bài lấy từ metadata; tùy chọn ẩn role/tools nếu rỗng. Không ép cover mặc định nếu người soạn muốn bắt đầu bằng text. Back, X, search, category nav và Project index luôn thuộc Hyper D shell.

## 7. API contract

### Public: chỉ đọc

| Method + endpoint | Hành vi |
| --- | --- |
| GET /api/v1/categories | Sáu category và thứ tự. |
| GET /api/v1/projects?category=&q=&cursor=&limit= | Summary phân trang, không body. Mặc định 24, max 48. |
| GET /api/v1/projects/:id | Published metadata + document + asset descriptors cần thiết cho bài. |
| GET /api/v1/projects/:id/adjacent | Previous/next ID theo category order rồi project sort_order rồi ID. |
| GET /media/:assetId | Chỉ asset của revision hiện đang public; stream từ R2. |

Summary gồm id, slug, categoryId, title, shortTitle, subtitle, thumbnail (src/width/height/alt), featured, contentState, revisionId. Detail không lẫn draft/version quản trị. API slug nếu bổ sung phải redirect/resolve ổn định, không dùng slug làm DB foreign key.

Search q tối đa 120 ký tự; normalize dấu như code hiện tại. LIKE có escape ký tự wildcard và bind; search_text của public projection chứa title/subtitle/tags/tools đã normalize. B-tree không tăng tốc LIKE '%term%'; ban đầu dữ liệu nhỏ chấp nhận, đo rows_read trước khi chuyển FTS. Không tải toàn bộ body để search.

Cursor mã hóa tuple sort, gắn filter/search vào cursor và validate; sort ổn định. Project index phải tải tiếp được, không chỉ hiển thị 24 item đầu rồi cho rằng hết. Next không được dựa trên list mới tải một trang. Cache/memo client theo ID+revision.

### Admin: cùng origin, xác thực mọi endpoint

| Method + endpoint | Chức năng |
| --- | --- |
| GET /api/admin/me | Danh tính chủ tài khoản và capabilities. |
| GET /api/admin/projects | List có draft/published/trash filter, search và pagination. |
| POST /api/admin/projects | Tạo record metadata + body empty, trả ID/version. |
| GET /api/admin/projects/:id | Draft, trạng thái public, version. |
| PUT /api/admin/projects/:id/draft | Save metadata+document, expectedVersion; 409 khi xung đột. |
| POST /api/admin/projects/:id/publish | Validate và xuất bản snapshot, có idempotency. |
| POST /api/admin/projects/:id/unpublish | Rút khỏi public, giữ dữ liệu. |
| DELETE /api/admin/projects/:id | Soft-delete + unpublish, có xác nhận UI. |
| POST /api/admin/projects/:id/restore | Khôi phục từ trash về draft. |
| GET /api/admin/projects/:id/revisions | Lịch sử snapshot, phân trang. |
| POST /api/admin/projects/:id/revisions/:revisionId/restore | Copy snapshot vào draft mới; không tự publish. |
| GET /api/admin/media | Thư viện asset; trạng thái/usage/size. |
| POST /api/admin/media | Upload mới với requestId; trả assetId khi ready. |
| GET /api/admin/media/:id/content | Xem ảnh draft qua Access, private/no-store. |
| PATCH /api/admin/media/:id | Đổi alt default/tên hiển thị, không đổi object key. |
| DELETE /api/admin/media/:id | Chỉ xóa được nếu không có draft/revision reference. |

Lỗi có JSON thống nhất: `{error:{code,message,fieldErrors?,requestId}}`. 400 input sai, 401 chưa login, 403 không đủ quyền, 404 không có/không public, 409 conflict/in-use, 413 quá lớn, 429 giới hạn, 503 DB/storage tạm lỗi. Không trả stack trace/SQL/token cho client.

## 8. Media upload và bảo vệ draft

V1 upload qua Admin Worker cùng origin, không cần phát S3 key cho browser. Ảnh tối đa 10 MB/file, JPEG/PNG/WebP/AVIF; video MP4/WebM tối đa 25 MB/file là giới hạn ứng dụng ban đầu. Chưa hỗ trợ PSD/AI/Blend/source downloads và SVG upload công khai ở MVP.

1. Chọn file → client đọc kích thước, tạo thumbnail/biến thể nếu cần; giữ preview để người dùng kiểm tra chất lượng.
2. API kiểm tra đăng nhập, byte limit trong khi stream, file signature/MIME và filename. Không chỉ kiểm tra đuôi file.
3. Tạo media row pending với object key UUID bất biến; upload R2; xác minh object rồi chuyển ready.
4. Gặp lỗi: pending/failed có thể retry bằng requestId; object mồ côi được thống kê để dọn sau.
5. Bài tham chiếu assetId; URL public được sinh bởi API, không lưu domain cứng trong document.
6. Asset chỉ public khi xuất hiện trong revision đang được public_projects trỏ tới. Public media route kiểm tra quan hệ này trước khi stream; draft route ở admin luôn cần auth.

D1 và R2 không có transaction chung. Không xóa file R2 trước khi đã xác định dữ liệu DB không tham chiếu nó. Khi publish asset thiếu, giữ bản public trước đó và báo media cần xử lý.

Đề xuất derivative: thumbnail ~480px; preview ~1200px; artwork lớn theo nhu cầu ~2000–3000px. Không nén label đến mức không đọc được chữ. V1 tạo biến thể ở browser/admin hoặc bước xử lý riêng; không mặc định Cloudflare Images/Stream là dịch vụ miễn phí đi kèm R2.

Không bật r2.dev cho bucket này. Nếu về sau cần CDN domain trực tiếp, tách riêng public bucket; không đặt draft và bản public chung bucket public. r2.dev được Cloudflare định hướng cho development và có giới hạn. [Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## 9. Cache, lazy load và chế độ offline

MVP public JSON: no-store ở edge để Publish/Unpublish phản ánh ở lần fetch tiếp theo; frontend giữ cache trong memory, revalidate khi mở lại Portfolio hoặc focus lại tab. Không hứa push realtime cho tab đang đứng yên. Chỉ thêm TTL/CDN JSON khi đo tải, kèm quy tắc invalidation rõ.

Media public có thể cache ngắn trên browser (ví dụ 60 giây) nhưng MVP không dùng edge cache bỏ qua kiểm tra public reference. Unpublish không thu hồi được file khách đã tải; URL mới phải bị từ chối khi không còn reference public. Preview/admin luôn private, no-store.

Không tải detail ở trang chủ. Khi mở All chỉ lấy featured summaries và trang đầu list. Khi chọn category: fetch summary đầu rồi detail của đúng bài đó. Có loading, error+Retry và empty khác nhau. Abort request cũ khi đổi tab nhanh, hoặc đối chiếu request/category trước khi setState để response chậm không đè tab mới.

Đề xuất repository:

```ts
interface PortfolioRepository {
  list(input: {category?: string; q?: string; cursor?: string; limit?: number}): Promise<ProjectPage>;
  get(id: string, signal?: AbortSignal): Promise<ProjectDetail>;
  adjacent(id: string): Promise<{previous: string | null; next: string | null}>;
}
// StaticRepository: seed hiện tại cho file:// và kiểm thử offline.
// HttpRepository: /api/v1 ở cloud; chỉ giữ summary+detail đã được yêu cầu.
```

Các type ProjectPage/ProjectDetail phải được định nghĩa trong shared/contracts trước khi dùng snippet. Không đưa body mọi bài vào cloud bundle chỉ để fallback. file:// là demo snapshot có chủ đích; cloud là live API. Nếu cloud API lỗi, hiển thị trạng thái lỗi, không âm thầm phục hồi một bài đã bị unpublish từ seed.

## 10. Hướng dẫn kết nối Cloudflare

### 10.1 Chuẩn bị trong repo

Đề xuất thêm thư mục, không di chuyển toàn bộ app đang chạy:

```text
app/portfolio/repository/       # static + HTTP adapters
shared/contracts/              # DTO, validators, schema version
shared/article/                # renderer bài dùng public + preview
admin/                         # React admin, build riêng
workers/public/src/            # public API và media
workers/admin/src/             # authenticated CRUD/upload
workers/public/wrangler.jsonc
workers/admin/wrangler.jsonc
db/migrations/
scripts/build-cloud.mjs
scripts/build-admin.mjs
scripts/seed-portfolio.mjs
dist/public/                   # chỉ deploy HTML/assets/public đã chọn
dist/admin/                    # chỉ deploy admin bundle
```

Không deploy assets.directory ở root repo: có nguy cơ upload source, backup, docs, node_modules. build-cloud chỉ copy file được allowlist vào dist/public. Bản build offline index.html hiện tại vẫn được hỗ trợ riêng.

### 10.2 Tài khoản và công cụ

1. Đăng nhập Cloudflare bằng tài khoản chủ; bật MFA cho tài khoản quản trị cloud.
2. Mở Workers & Pages, chọn workers.dev subdomain. Ghi account ID vào cấu hình triển khai thích hợp.
3. Kích hoạt R2, đọc free allowance và billing trước khi hoàn tất subscription.
4. Cài Wrangler làm devDependency của repo và khóa version trong lockfile. Lệnh dưới đây là hướng dẫn cho task triển khai, chưa chạy ở lượt lập kế hoạch.

```powershell
npm install --save-dev wrangler
npx wrangler login
npx wrangler whoami
npx wrangler d1 create hyperd-content-staging
npx wrangler r2 bucket create hyperd-media-staging
```

Ghi database_id từ output thực. Không bịa ID hoặc dùng ID staging cho production. `login` mở trình duyệt để chủ tài khoản xác nhận; không yêu cầu gửi password/API key vào chat.

### 10.3 Cấu hình staging mẫu

`workers/public/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "hyperd-public-staging",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-11",
  "workers_dev": true,
  "assets": {
    "directory": "../../dist/public",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*", "/media/*"]
  },
  "d1_databases": [{
    "binding": "DB",
    "database_name": "hyperd-content-staging",
    "database_id": "REPLACE_WITH_ACTUAL_STAGING_ID",
    "migrations_dir": "../../db/migrations"
  }],
  "r2_buckets": [{"binding": "MEDIA", "bucket_name": "hyperd-media-staging"}]
}
```

Admin config tương tự nhưng name `hyperd-admin-staging`, assets directory `../../dist/admin`, `run_worker_first: true`, binding cùng DB/bucket staging. Thêm vars `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_SUBJECT`; giá trị lấy sau khi cấu hình Access. Mọi route admin qua Worker/auth trước khi ASSETS trả file. Production dùng file cấu hình riêng với name/ID/bucket production; không dựa vào binding kế thừa ngầm.

Routing public phân biệt API/media trước fallback assets; API không tồn tại trả JSON 404, không trả index.html. [Static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/), [Wrangler config](https://developers.cloudflare.com/workers/wrangler/configuration/).

### 10.4 Migration, local và deploy

Sau khi đã tạo file migrations/entry và build scripts:

```powershell
npx wrangler d1 migrations apply hyperd-content-staging --local --config workers/public/wrangler.jsonc
npx wrangler dev --config workers/public/wrangler.jsonc
```

Local dùng D1/R2 emulation, không remote production bindings. Nếu hai local Worker cần chung dữ liệu, cấu hình persistence root chung được kiểm chứng trong task hạ tầng; không mặc định hai lệnh dev tự dùng chung DB. Có thể test từng Worker độc lập với cùng fixtures trước.

Sau khi migration local và test pass:

```powershell
npx wrangler d1 migrations apply hyperd-content-staging --remote --config workers/public/wrangler.jsonc
npx wrangler deploy --config workers/public/wrangler.jsonc
npx wrangler deploy --config workers/admin/wrangler.jsonc
```

Trước deploy chạy build-cloud/build-admin đã được bổ sung. Admin phải fail closed khi Access vars chưa cấu hình; deploy đầu không được để write API public tạm thời. Không chạy remote migration trước backup đối với DB đã có dữ liệu. [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/).

### 10.5 Bảo vệ web admin

Trong Cloudflare Access tạo application cho toàn bộ hostname admin, Allow đúng email/identity của chủ; không Allow Everyone. workers.dev có hỗ trợ bảo vệ bằng Access. Kiểm tra cả hostname chính, preview URL và mọi custom domain để không có đường vòng. [Access on Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).

Worker xác minh chữ ký JWT từ `Cf-Access-Jwt-Assertion`, issuer, audience, expiry và identity allowlist bằng thư viện JWT chuẩn; lấy khóa từ JWKS của team Access. Không tin mỗi header email hay việc user biết URL admin. Không tự triển khai mật khẩu riêng ở MVP. [Validate JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

Request thay đổi dữ liệu kiểm tra Origin đúng admin origin và CSRF token gắn session; GET không thay đổi state. Chặn CORS write từ origin khác. Token cloud deploy giữ ở secret CI, không bundle vào frontend. Public Worker chỉ implement read routes; mặc dù binding DB có khả năng ghi, không cung cấp write path công khai.

### 10.6 GitHub và tên miền

Giữ GitHub để version source/migrations. Có thể cấu hình Workers Builds kết nối repo hoặc GitHub Actions; chọn một cơ chế để tránh deploy trùng. Workflow sau này gồm typecheck/test cần thiết → build output → staging → kiểm tra → production. Không tự chạy migration phá dữ liệu mỗi commit.

Nếu giữ Pages tạm thời: API_BASE_URL public trỏ public Worker; Access-Control-Allow-Origin dùng origin thật (không gồm repo path), Vary: Origin; public GET không cần credential. Admin không chạy từ file://. Cloudflare same-origin là đích triển khai đề xuất.

Khi chuyển custom domain: thêm domain vào Cloudflare nếu cần, cập nhật routes, siteUrl/canonical, API origin và Access audience/policy. Kiểm tra www/apex/worker preview routes. Không đổi slug/project ID khi đổi domain.

## 11. Các chức năng chi tiết của admin

UI bằng tiếng Anh theo Hyper D; tài liệu hướng dẫn có thể tiếng Việt. Dùng UI UX Pro Max khi triển khai màn hình admin, giữ typography gọn, không áp font Designer cho bảng dữ liệu. Các màn hình dưới đây là functional specification, chưa chốt mockup pixel.

### A. Projects — màn hình chính

- Grid thumbnail + title, toggle sang bảng khi cần quản lý nhiều data.
- Filter Design/Development/category và Draft/Published/Unpublished changes/Trash; search tên, tag, tool.
- Card hiển thị category, trạng thái, last edited, Content empty nếu chưa có body.
- Add project mở form metadata. Click thumbnail hoặc title mở editor, không đi qua trang trung gian khác.
- Menu card: Edit details, Duplicate as draft, Publish/Unpublish, Move to trash.
- Sort order trong category bằng nút hoặc kéo thả có alternative; publish thứ tự rõ ràng, không auto publish khi drag.
- Featured checkbox điều khiển banner All. Không cho người dùng nhập thành tích/thống kê giả để lấp UI.

### B. Add/Edit details

Required: group, category, thumbnail, title, subtitle. Group giới hạn category phù hợp. Short title mặc định theo title, có thể sửa cho card; slug tự sinh và kiểm tra trùng. Optional: role, tools, tags, year/client khi có dữ liệu thật.

Save trả về card mới ở library; thêm nút Save & edit content để đi thẳng editor. Upload thất bại giữ form và cho retry. Save title/subtitle không bắt phải có cover hoặc body. Trước Publish preview card để kiểm tra nhãn dài và thumbnail.

### C. Article editor

- Toolbar: Back, tên bài, Draft/Published state, Saving/Saved/Error, Undo/Redo, Preview, Save draft, Publish.
- Canvas giữa hiển thị bài; Add block tại đầu/cuối hoặc giữa hai khối.
- Sidebar properties chỉ xuất hiện khi chọn block. Hỗ trợ upload/chọn asset đã có, sửa alt/caption, width, spacing, columns.
- Kéo sắp xếp và nút Move up/down; Delete/duplicate block có undo.
- Autosave debounce ~2 giây sau thay đổi khi hợp lệ; chỉ hiện Saved khi API xác nhận. Nút Save cho thao tác chủ động.
- Mất mạng: giữ buffer cục bộ, thông báo chưa lưu; khi kết nối lại kiểm tra version trước retry. Không gọi local buffer là đã lưu cloud.
- Rời trang khi còn thay đổi chưa lưu có cảnh báo. Session hết hạn cho đăng nhập lại rồi thử save, không xóa canvas.
- Preview desktop/mobile dùng shared renderer; nháp không có public preview URL. Không đưa draft vào iframe public không auth.
- Publish dialog tóm tắt metadata, số block/media và cảnh báo body empty; cho phép Publish card only đúng yêu cầu.

### D. Media library

Upload nhiều ảnh, progress từng file, retry/cancel; filter image/video, search tên, preview dimensions/bytes, copy reference, alt default và usage list. Chọn media đã có không nhân đôi binary. Không xóa asset đang dùng; hiển thị bài/revision nào đang tham chiếu. Tạo derivative có provenance để export/backup không sót.

### E. Revisions và Trash

Revisions hiển thị ngày, người lưu, version và preview; restore tạo draft mới. Trash giữ record và media references, có Restore. Delete permanently chỉ là phase maintenance sau khi retention/reference checks hoàn chỉnh; không cần cho CRUD thường ngày.

### F. Dashboard vận hành tối giản

Số bài theo trạng thái, bài thiếu body/thumbnail, upload lỗi, storage usage có nguồn đo thực và thời điểm cập nhật. Không fake số liệu. Thông tin billing gắn link dashboard Cloudflare; không đòi account-wide token ngay trong admin chỉ để hiển thị đồ thị.

### G. Settings và phạm vi sau MVP

Settings MVP: profile đăng nhập, environment, export dữ liệu, thông tin schema/build. Chưa có sửa CSS/theme/nav.

Phase sau thêm quản lý nội dung CV: facts, experience, skills, capability text, contact links. Dùng bảng/contract riêng, giữ layout CV cố định. Không đưa calendar thực, Codex placeholder hoặc Power action vào quản trị nội dung portfolio.

### Responsive admin

Desktop ưu tiên soạn bài với canvas rộng + inspector. Tablet inspector thành drawer. Mobile có thể CRUD metadata, upload, sửa text, reorder bằng nút, preview và publish; inspector dạng sheet, toolbar save/publish dễ chạm. Không hứa thao tác kéo nhiều cột trên mobile giống desktop. Kiểm tra 390px, 768px và 1440px; keyboard không che vùng nhập/save.

## 12. Migration dữ liệu hiện tại

1. Inventory từ data.ts và asset paths thực; export seed JSON có legacyId, không retype thủ công.
2. Upload các ảnh thật vào R2, ghi mapping legacy path → assetId; kiểm tra MIME/dimensions thực của file.
3. Tạo project draft giữ category ID, title, shortTitle, summary→subtitle, role/year/tools/tags/order.
4. Chuyển cover và sections thành các block tương ứng để tái hiện bài hiện tại; caption/alt giữ nguyên dữ liệu đã có.
5. Seed có thể chạy lại mà không duplicate theo legacy ID/checksum. Không overwrite bản đã sửa trong admin.
6. Các placeholder Game/Web/App được nhập thành card body empty hoặc draft; không coi là thành tích thật. Publish card empty theo quyết định chủ.
7. Preview staging đối chiếu screenshot/bản cũ rồi publish ba bài hiện có.
8. Chuyển cloud frontend sang HttpRepository. Bản offline dùng StaticRepository riêng.
9. Không xóa asset local ngay khi migration; chỉ dọn khi đã kiểm chứng cloud và rollback.

## 13. Backup, phục hồi và bảo trì

D1 Free có Time Travel 7 ngày; đây không thay thế backup media R2 hoặc export dài hạn. [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

Trước mỗi migration remote: export SQL qua Wrangler và manifest asset. Lịch đề xuất sau go-live: export hàng ngày, giữ 7 daily + 4 weekly; backup private ngoài Git public. R2 backup phải bao gồm binary/derivative hoặc bản copy ở nơi độc lập, không chỉ danh sách key. Bản export DB không chứa file ảnh.

Restore drill trên staging: import SQL → phục hồi object keys → đối chiếu số project/revision/media → mở 3 bài mẫu → publish thử. Mất R2 object phải báo missing media, không gỡ bài tự động.

Rollback UI/API code giữ tương thích schema trước đó; migration dùng expand/contract khi cần. Không coi rollback Worker là rollback D1. Dọn orphan assets/revisions phải dry-run, có log và giới hạn phạm vi trước khi xóa thật.

## 14. Thứ tự công việc cho các task sau

Không cần hoàn thiện mọi hiệu ứng Hyper D trước khi làm data. Ưu tiên một luồng xuyên suốt: tạo project → upload → body empty → publish → Hyper D đọc. Sau đó nâng cấp editor.

| Task | Đầu ra cụ thể | Điều kiện hoàn thành |
| --- | --- | --- |
| DB-01 Contracts | shared DTO, document validator, category mapping; không đổi UI | Summary không chứa body; empty body hợp lệ; ID cũ giữ nguyên. |
| DB-02 Schema | SQL migration, local seed, version conflict strategy | FK/unique/check đúng; seed chạy lại không duplicate; save conflict không overwrite. |
| CF-01 Infrastructure | Hai Worker, staging D1/R2, config local/staging, dist allowlist | Static và health endpoint hoạt động; chưa auth thì admin fail closed. |
| API-01 Auth + CRUD | Access validation, project draft CRUD, soft delete | Request không auth bị chặn; lưu và đọc draft; 409 hai tab. |
| API-02 Media | Upload/library/preview, references | Pending retry được; draft media không public; không xóa ảnh đang dùng. |
| API-03 Publish | Atomic snapshot + public projection + public list/detail | Draft sửa không đổi public; empty body publish được; unpublish 404. |
| FE-01 Cloud adapter | Async list/detail/index/next/search trong Hyper D | Mở category trực tiếp; loading/race handling; không tải mọi body. |
| ADM-01 Admin library | Add/edit metadata, grid/table, filter, trash | Chủ tự tạo card và bấm vào editor. |
| ADM-02 Editor nền | Text/image/heading, reorder, save, preview | Soạn và publish bài hoàn chỉnh đầu tiên bằng UI. |
| ADM-03 Editor mở rộng | Gallery/columns/video/links, revision restore | Hai bài có bố cục khác nhau; mobile reflow đúng. |
| MIG-01 Migration | Seed 3 bài thật + placeholder policy | Asset mapping đầy đủ, screenshot đối chiếu, dữ liệu không bịa. |
| OPS-01 Production | DB/bucket production riêng, deploy, backup/restore | CRUD→publish end-to-end production; backup đã restore thử staging. |

Mỗi task đọc master này và phần source liên quan; chỉ cập nhật mục tiến độ ngắn khi có thay đổi quyết định. Không đọc lại toàn bộ tài liệu UI hoặc chạy toàn bộ test sau từng chỉnh CSS nhỏ. Test tập trung vào phần thay đổi; full integration ở các mốc API/publish/deploy.

## 15. Acceptance checklist có ý nghĩa

- Tạo project chỉ có metadata; Save xong thấy thumbnail+title trong admin.
- Publish body empty → Hyper D có card và thông báo content đang chuẩn bị.
- Thêm ảnh/text/columns, Save draft → public vẫn là bản cũ; Publish → lần fetch sau có nội dung mới.
- Publish lỗi giữa giao dịch → không xuất hiện metadata/body khác phiên bản.
- Hai tab cùng sửa → tab cũ nhận 409, bản mới không mất.
- Draft project và draft media không truy cập được bằng public URL kể cả đoán ID.
- Unpublish/Trash → public detail và media không còn tham chiếu public bị từ chối ở request mới.
- Search và index nhiều trang; next không kẹt ở trang summary đầu tiên.
- Đổi category nhanh khi mạng chậm → không hiển thị nhầm response category trước.
- Upload gián đoạn retry không tạo hàng loạt object trùng; ảnh đang dùng không xóa được.
- Hai bài dùng cách trình bày khác nhau; preview và Hyper D dùng cùng renderer; xem được trên mobile.
- Hyper D không tải admin bundle, secret hoặc toàn bộ body khi mở trang chủ.
- Không cần Git push cho thao tác Save/Publish/Unpublish hằng ngày.
- Backup SQL+media phục hồi được trên staging; code rollback không phá schema.

## 16. Những thông tin cần lấy khi bắt đầu kết nối thật

Chưa phải blocker cho thiết kế local: tài khoản Cloudflare sẽ dùng, email/identity owner, workers.dev subdomain, có custom domain chưa, tài khoản đã kích hoạt R2/billing chưa, URL GitHub Pages thật nếu giữ giai đoạn chuyển tiếp. Không yêu cầu password trong chat.

Các lựa chọn đã có mặc định để task sau tiến hành: một owner; hai deploy cùng repo; D1/R2 theo môi trường; All giữ nguyên layout; nội dung tiếng Anh; Save draft tách Publish; body empty được public có chủ đích. Không tự thêm multi-tenant, cộng tác realtime, thanh toán, public signup hoặc visual builder cho cả website.

## 17. Prompt tiếp nối

“Đọc design-system/DATA-ADMIN-CLOUDFLARE-MASTER.md. Bắt đầu DB-01 và DB-02: contracts summary/detail, document schema, migrations D1 và seed từ data.ts hiện tại. Giữ nguyên layout Hyper D và category IDs. Chuẩn bị kiểm thử local cho version conflict, draft/public isolation, empty-body publishing và media references. Chưa tạo tài nguyên remote khi chưa đến CF-01. Bàn giao file thực, kết quả kiểm tra và việc tiếp theo.”

## 18. Trạng thái hiện tại

- [x] Audit cấu trúc Hyper D và luồng đã thống nhất.
- [x] Chọn kiến trúc và viết master database/Cloudflare/admin.
- [x] DB-01 Contracts: shared DTO, category mapping, document schema/validator và contract tests đã triển khai.
- [x] DB-02 Schema: migration D1, seed sinh từ `app/portfolio/data.ts` và kiểm thử local đã triển khai.
- [x] CF-01 Infrastructure: hai Worker, allowlisted builds, health routing, local persistence, D1/R2 staging, deploy và smoke test đã hoàn thành; Admin đang fail-closed.
- [ ] API-01 đến OPS-01: chưa triển khai.
- [ ] Cloudflare bindings: OAuth, D1 staging APAC và R2 staging đã kết nối, migration `0001` đã áp remote; Access chưa cấu hình.
- [ ] Admin screens/editor: chưa build.

Kết quả DB-01/DB-02: 6 category ID cũ, 6 project và 4 media duy nhất được seed; 3 placeholder dùng body empty hợp lệ. Kiểm thử xác nhận seed idempotent, optimistic version guard, draft/public isolation, foreign-key media và giới hạn document contract. Chưa có tài nguyên Cloudflare remote nào được tạo.

Tài liệu này chỉ hoàn thành bước lên kế hoạch. Không có SQL, lệnh cloud hoặc snippet nào trong tài liệu được coi là đã chạy trên production.
