# Hyper D² Portfolio — Master triển khai

Ngày: 2026-09-11. Trạng thái: đã triển khai; tài liệu này là hợp đồng duy trì cho các task sau.

## 1. Mục tiêu và thứ tự ưu tiên

Chuyển cửa sổ nghe nhạc thành trình duyệt portfolio, mở bằng button Portfolio ở trang chính. Giữ cảm giác cửa sổ bo góc của website, dùng bảng màu của layout đang chọn. Dự án là trọng tâm; điều hướng chỉ hỗ trợ xem dự án.

Ưu tiên: đúng yêu cầu → nội dung đọc được → điều hướng rõ → responsive → hiệu ứng. Không ép nội dung case study vào một màn hình. Trang tổng hợp gọn, case study cuộn tự nhiên như Behance.

Master này là hợp đồng cho task triển khai, không phải bằng chứng code mẫu đã chạy. Các snippet là nền để lắp ráp; phải kiểm tra type, tương tác và giao diện thật trước bàn giao. Khi code thực tế khác snapshot dưới đây, đọc lại file hiện hành trước khi patch.

### Yêu cầu đã chốt

1. Bỏ thanh phát nhạc, timeline, volume, trạng thái bài hát khỏi cửa sổ portfolio.
2. Desktop: phân loại bên trái, nội dung ở giữa, danh sách dự án bên phải. Giảm bề ngang danh sách khoảng 30% so với panel track-list hiện tại.
3. Sáu phân loại hiển thị: Brand, Visual, 3D; Game, Web, App. Thêm All làm màn hình tổng quan mặc định khi mở từ hero/launcher.
4. Trang tổng hợp có tiêu đề Hyper Design, thumbnail vuông; thêm Hyper Development bên dưới để không trộn thiết kế và phần mềm vô tổ chức.
5. Bấm thumbnail mở case study đúng dự án và kích hoạt phân loại tương ứng. Nội dung đọc bằng cuộn dọc; không chuyển sang website khác.
6. Mobile: search và X ở một hàng cố định phía trên; danh sách dự án ngang phía trên bộ phân loại ở đáy; phân loại có hàng Design trên, Dev dưới.
7. X luôn đóng được khi đang ở bất kỳ vị trí cuộn nào.
8. Website vẫn mở trực tiếp bằng index.html, không yêu cầu backend hoặc dev server.

### Diễn giải đã chọn để triển khai

- `Brand` dùng data ID `illustrator`, `Visual` dùng data ID `photoshop`, `3D` dùng data ID `blender`. Tên trợ năng/tooltip ở shortcut ngoài rail vẫn nêu phần mềm thật. Công việc AI automation dùng tag `AI` trong App/Web tùy sản phẩm, không tạo phân loại thứ bảy.
- “Danh mục” bên phải là DANH SÁCH DỰ ÁN thuộc phân loại hiện hành, không lặp lại sáu phân loại và không phải bảng xếp hạng. Không có lượt nghe, thứ hạng hay số liệu giả.
- “Hover đúng sản phẩm” nghĩa là active category đồng bộ với dự án đang mở; không giả lập CSS hover bằng state.
- Mỗi portfolio item là một case study, không phải một landing page marketing độc lập có nav/footer riêng. Chung khung đọc, nhưng nội dung có các mẫu Design/3D/Software khác nhau.
- 25% mobile là tỷ lệ tổng của bộ điều khiển đáy so với chiều cao cửa sổ portfolio. Diễn giải 20% là phần phân loại ở đáy, 5% là dải dự án phía trên. Đây là mục tiêu trên điện thoại thông thường, không phải ràng buộc được phép làm nút bé hơn 44px.
- Chưa có thông tin thì để draft và không publish. Không tự bịa khách hàng, vai trò, thời gian, số liệu thành công hoặc đường dẫn demo.

## 2. Căn cứ UI UX Pro Max

Đã đọc skill `C:/Users/thietke06.VINUT/.codex/skills/ui-ux-pro-max/SKILL.md`, hướng dẫn layout/typography/accessibility trong `references/quick-reference.md` và checklist `references/pro-rules.md`.

Tra cứu thực tế ngày lập master:

| Query | Kết quả sử dụng / quyết định |
| --- | --- |
| `creative portfolio case study --design-system` | Có pattern Scroll-Triggered Storytelling: intro → vấn đề → quá trình → kết quả. Dùng trình tự nội dung, không dùng scroll hijacking. |
| Cùng kết quả trên: Brutalism, màu hồng/cyan, font Archivo/Space Grotesk | Không phù hợp nhận diện hiện tại; KHÔNG áp dụng. |
| `minimalism rounded portfolio --domain style` | Minimalism & Swiss Style: hệ lưới, hierarchy rõ, ít trang trí, hover nhẹ. Dùng nguyên tắc; không lấy radius 0 hoặc đổi palette/font theo output. |
| `mobile bottom navigation --domain ux` | Back predictable; điều khiển cố định phải dành chỗ cho nội dung; chú ý bàn phím mobile. |
| `state derived filtering --stack react` | Tính danh sách từ state, không giữ nhiều bản sao; không dùng effect để xử lý click/filter. |

Áp dụng vào Hyper D²: radius mềm hiện có, token layout hiện có, Designer cho tiêu đề thương hiệu, GoogleSansFlex cho nội dung. Body tối thiểu 16px; labels bình thường, không uppercase và giãn chữ hàng loạt. Kích thước chạm ≥44×44px, focus rõ, reduced-motion, không có hai lớp active cạnh tranh.

## 3. Snapshot repo và giới hạn sửa

Root: `D:/program project/HyperDesignDev`.

| Vị trí hiện tại | Việc cần làm khi triển khai |
| --- | --- |
| `app/page.tsx`, `View` | Thay nhánh `music` bằng `portfolio`, rà toàn bộ consumer. |
| `PortfolioIntro` | Hiện chỉ có `onOpenAbout`; thêm `onOpenPortfolio`, nối button `data-action="portfolio"`. |
| `MusicApp` | Thay bằng PortfolioApp riêng. Không nhồi tất cả logic mới vào page.tsx. |
| `LeftRail` | `Open Feishin` → `Open Portfolio`, icon thích hợp; update active view và nhãn active-window. |
| `LauncherDrawer` | Entry Feishin/music → Portfolio/portfolio. |
| `Home` / `openView` / Escape | Audit toàn bộ route, shortcut, overlay, trạng thái media đang chia sẻ. |
| `app/globals.css` | Music window hiện `118px minmax(550px,1fr) minmax(365px,30%)`, hàng player 104px. Không tái dùng min-width 550px trên mobile. |
| `app/layouts.css` | Kế thừa token; giữ `gallery` là ID Code Lab, tuyệt đối không đổi ID theme khi đổi tên hiển thị. |
| `app/portfolio-scenes.*` | Đây là hero scene trang chính, không phải viewer mới. Không sửa để xây portfolio window. |
| `scripts/build.mjs` | CSS hiện đọc danh sách cố định `globals.css`, `layouts.css`, `portfolio-scenes.css`; cần thêm `portfolio.css` vào danh sách này. Chỉ import TSX không đảm bảo CSS được build. |
| `tests/rendered-html.test.mjs` | Test cũ mở Feishin và bấm Play; thay test nhánh này bằng hành trình Portfolio. Giữ các test About/layout/static path. |
| `assets/app.js`, `assets/app.css`, `index.html` | Là output build. Không chỉnh tay. |

Files dự kiến thêm:

```text
app/portfolio/
  PortfolioApp.tsx          # window frame, route state, wiring
  CategoryNav.tsx           # 1 DOM nav, responsive bằng CSS
  ProjectIndex.tsx          # 1 DOM list: desktop dọc / mobile ngang
  Overview.tsx              # Hyper Design + Hyper Development
  ProjectCard.tsx           # thumbnail, title, type
  CaseStudy.tsx             # header, sections, next/back
  CaseSection.tsx           # typed section rendering
  types.ts
  data.ts                  # registry tĩnh; không fetch JSON từ file://
  selectors.ts             # filtering, normalization
  navigation.ts            # reducer
app/portfolio.css
```

Không sửa CV/avatar/sidebar layout picker trong task này. Không xóa asset công việc hoặc data có consumer khác. Audio trong overlay `media`/dashboard có thể độc lập: audit trước khi dọn; yêu cầu này chỉ thay cửa sổ music và các lối mở cửa sổ đó. Không âm thầm xóa mọi tiện ích âm thanh của shell.

## 4. Information architecture và nội dung

### Desktop nav, từ trên xuống

```text
Brand
Visual
3D
─────────
All   ← mở mới mặc định từ hero/launcher
─────────
Game
Web
App
```

Không cần button Menu/Home/Search riêng bên trái. Search có input cố định phía trên viewer. Mỗi nút có icon + tên; dùng Lucide cho chức năng, monogram Ps/Ai hoặc asset brand đã có nếu cần. Không vẽ logo thương hiệu sai hình.

### Ba mức màn hình

1. All: hero nhỏ “Selected work / Hyper D²” hoặc dự án nổi bật có thật; Hyper Design và Hyper Development là các section thumbnail. Không giữ banner THE BOOK 3 hoặc tên nghệ sĩ. Hero không chiếm hơn khoảng 25–30% vùng giữa ở màn hình desktop tham chiếu.
2. Category: bấm category mở thẳng case study đầu tiên của category. Project index chỉ render project thuộc category đó; category chưa có dữ liệu thật dùng placeholder trung thực.
3. Project: case study cuộn dọc. Header tên dự án + summary ngắn + role/tools/year nếu có thật; media full width; phần diễn giải; kết quả; dự án tiếp theo và Quay lại danh sách.

### Case study nên trông như thế nào?

Design (Brand / Visual): cover lớn → bối cảnh ngắn → artwork nguyên vẹn → chi tiết crop nếu có ảnh thật → ứng dụng/mockup → kết quả. Không đặt tất cả ảnh vào card dày viền. Hạn chế prose dài, để tác phẩm dẫn câu chuyện.

3D: hero render → yêu cầu không gian/sản phẩm → các góc nhìn → wireframe/process nếu được cung cấp → video tùy chọn (click để play, không autoplay có tiếng).

Game/Web/App: screenshot/video demo → bài toán → vai trò/phạm vi → flow/interface → giải pháp kỹ thuật ngắn → link demo/repo nếu có → kết quả được xác nhận. Không tự dựng terminal/code giả để làm dự án trông “có công nghệ”.

Mỗi dự án có thể có accent/artwork background riêng trong media canvas. Khung nav/search/X vẫn theo theme chung. Không thay font/định vị điều khiển ở từng dự án.

### Asset inventory có thật

| ID đề xuất | Category chính | Asset đã có | Tiêu đề đề xuất | Trạng thái nội dung |
| --- | --- | --- | --- | --- |
| `vinut-coco-boba-label` | illustrator | `./public/vinut-coco-boba-label.webp` | Vinut Coco Boba — Label | Artwork có thật; chưa có mô tả brief/process/metrics. |
| `coco-boba-tini-world` | photoshop | `./public/coco-boba-poster.webp` | Coco Boba Tini World | User xác định thẻ Photoshop; không tự gán thêm Blender. |
| `nam-viet-exhibition` | blender | `./public/nam-viet-group-booth.webp` | Nam Viet Group — Exhibition Booth | Có render; category Blender là giả định cần xác nhận trước publish thông tin tool. |

Ảnh `concept-label.png`, `concept-retouch.png`, `concept-booth.png` là concept cũ, KHÔNG dùng làm dự án khách hàng. Không dùng portrait android/ảnh CV làm thumbnail công việc đã giao. Chưa có screenshot Game/Web/App thì để category rỗng, không tạo project giả. Có thể triển khai viewer với 2 artwork đã xác nhận và 1 draft booth.

Thumbnail 1:1 là khung hiển thị, không sửa file gốc. Artwork chữ nhiều (label) dùng contain trên nền trung tính, poster có thể cover ở thumbnail; case study luôn contain/width 100% để không cắt chữ tác phẩm.

## 5. Layout desktop và tablet

```text
┌───────────┬─────────────────────────────┬─────────────────┐
│           │ Search                      │              X  │ ← header
│ Category  ├─────────────────────────────┼─────────────────┤
│ nav       │                             │ Projects        │
│           │ Overview / Case study       │ thumbnail+name  │
│ All       │ scroll dọc độc lập           │ active project  │
│           │                             │ scroll dọc      │
│ Dev       │                             │                 │
└───────────┴─────────────────────────────┴─────────────────┘
Không có player phía dưới.
```

Desktop ≥1200px viewport: nav 104px; project index `clamp(224px,21%,340px)`. 21% = 70% × 30% cũ. Ở chiều rộng cửa sổ khoảng 1800px, panel cũ ~540px, panel mới cap 340px, giảm khoảng 37%; chấp nhận vì mục tiêu là thêm chỗ cho artwork. Nếu yêu cầu đo đúng 30% tại 1920px thì bỏ cap 340 và dùng 21%; ghi quyết định trong QA, không đổi ngầm. Mặc định master chọn cap 340px.

Header 60px; viewer `minmax(0,1fr)`; right list min-width 0. Nav/category chia ba nhóm bằng flex gap, không nth-child margin-top:auto khó kiểm soát. Desktop thumbnail grid 3 cột ở viewer rộng, 2 cột nếu viewer <720px; gap 16–20px. Dùng container query của viewer, không chỉ viewport.

Tablet 821–1199px: nav 88px, header 56px, bỏ panel phải dạng cột; ProjectIndex thành strip ngang hàng 52px phía trên viewer. Giữ dự án hiện tại và scroll vị trí khi xoay màn hình.

## 6. Mobile — chốt hình học và điều khiển

```text
┌─────────────────────────────┐
│ Search…                  X  │ 56px, ngoài vùng scroll
├─────────────────────────────┤
│                             │
│ overview / case study       │ phần còn lại, cuộn dọc
│ artwork không bị dock đè    │
│                             │
├─────────────────────────────┤
│ ◀ dự án 1 | dự án 2 | … ▶   │ khoảng 5%, ngang
├───────┬──────┬──────┬────────┤
│ All   │Brand │Visual│ 3D     │
│ hợp   ├──────┼──────┼────────┤ khoảng 20%, 2 hàng
│       │ Game │ Web  │ App    │
└───────┴──────┴──────┴────────┘ + safe-area
```

- All bên trái span 2 hàng, còn 3 cột tạo hàng Design và Dev. Không thêm một hàng All làm dock chiếm thêm chiều cao.
- Mục tiêu H=chiều cao cửa sổ: project strip = max(44px,5%H), nav = max(104px,20%H). Ví dụ H=800: strip 44, nav160, tổng204 (~25.5%); H=640:44+128=172 (~26.9%). Safe-area có thể làm tỷ lệ tăng. Không tuyên bố đúng tuyệt đối 25% ở mọi máy.
- Ở chiều cao khả dụng <560px hoặc mobile landscape: dock compact 44+104px, header48px. Nếu vẫn ít chỗ, tiếp tục cuộn viewer; không thu chữ dưới 16px hay nút dưới 44px.
- Search focus + bàn phím: ẩn dock tạm thời bằng state `searchFocused` trên mobile, mở rộng viewer cho kết quả. Header và X vẫn hiện. Blur/close keyboard phục hồi dock, không reset project. Không tự autofocus search khi mở trên mobile.
- Project strip vuốt native `overflow-x:auto`, không cài drag để đổi dự án tự động. Click/tap mới chọn, tránh vuốt vô tình mở dự án. Desktop nếu cần kéo chuột thì phải phân biệt drag threshold, không yêu cầu ở bản đầu.
- Project item tối thiểu44px cao, thumbnail32px + tên ngắn; full title qua accessible name. Không dùng tooltip làm cách duy nhất đọc tên trên touch.
- X44px có aria-label Close portfolio, nền đủ đục và focus ring. Header/dock là siblings của vùng scroll, không position bên trong content dài và không margin âm bù sticky.
- Tận dụng cửa sổ `.desktop-surface` hiện có: sidebar shell vẫn chiếm52px trên mobile. Tất cả phép tính theo phần còn lại, không theo toàn viewport. Kiểm tra viewport375 thì viewer thực tế chỉ khoảng290px.

## 7. Hợp đồng tương tác

| Sự kiện | Kết quả bắt buộc |
| --- | --- |
| Open Portfolio từ hero/launcher | category=all, query='', projectId=null; overview top; All active. |
| Open shortcut ở rail ngoài | mở thẳng project đầu tiên của category tương ứng; remount Portfolio để shortcut hiện tại luôn có kết quả xác định. |
| Click category | category mới, project=null, query giữ; viewer top; index lọc cùng nguồn dữ liệu. |
| Click thumbnail overview | projectId=item.id; category=item.primaryCategory; query=''; viewer top; active nav đúng. |
| Click ProjectIndex item | cùng hành vi open project; không tự đóng portfolio. |
| Hover category khác | chỉ đổi hover; không đổi category/project; active cũ giữ marker, hover không có marker active. |
| Back to results trong case study | phục hồi snapshot category/query/scroll trước khi mở dự án. |
| Bấm X | đóng toàn bộ window, về desktop, trả focus về control đã mở. |
| Escape | nếu input có query: clear; nếu query rỗng: đóng Portfolio. Giữ cùng quy tắc dù đang xem project. |
| Search nhập | chuyển sang results, lọc theo category hiện tại; list phải và grid dùng cùng selector. |
| 0 result | thông báo thật + Clear search + All; không ngầm mở dự án đầu tiên. |
| Click dự án tiếp | chỉ trong tập published cùng category, ở cuối ẩn next; không vòng lặp vô hạn. |

Không render đồng thời overview và case study bằng CSS hide trong khi cả hai vẫn tab focus được. Không dùng hover để tự chuyển category. Không cuộn nội dung của project này sang project khác khi chạm đáy.

Browser Back trong bản đầu: không tạo history entry giả bằng effect; dùng Back to results rõ ràng. Deep link/hash/browser-history tích hợp đầy đủ là phase tùy chọn, chỉ làm nếu audit tương thích với shell và file://. Không quảng cáo deep link dự án khi chưa có.

## 8. Data contract — mã nền

```ts
// app/portfolio/types.ts
export type Category = 'photoshop' | 'illustrator' | 'blender' | 'game' | 'web' | 'app';
export type Filter = 'all' | Category;
export type Media = {
  src: string; alt: string; width: number; height: number;
  fit?: 'cover' | 'contain';
};
export type Section =
  | { id: string; type: 'text'; title: string; paragraphs: string[] }
  | { id: string; type: 'image'; media: Media; caption?: string }
  | { id: string; type: 'gallery'; items: Media[]; columns: 1 | 2 }
  | { id: string; type: 'video'; src: string; poster: Media; caption?: string }
  | { id: string; type: 'links'; items: { label: string; href: string }[] };
export type Project = {
  id: string; title: string; summary: string;
  primaryCategory: Category; tags: string[];
  status: 'draft' | 'published'; order: number;
  thumbnail: Media; cover: Media; sections: Section[];
  role?: string; year?: string; client?: string; tools?: string[];
};
export const categoryLabels: Record<Filter, string> = {
  all: 'All', photoshop: 'Visual', illustrator: 'Brand', blender: '3D',
  game: 'Game', web: 'Web', app: 'App',
};
```

ID kỹ thuật cũ được giữ để không phải migrate data. Nhãn hiển thị mô tả loại công việc thay vì phần mềm:

- `illustrator` → Brand: packaging, label, logo và vector identity.
- `photoshop` → Visual: poster, retouch, compositing và campaign imagery.
- `blender` → 3D: product visualization, spatial concept và exhibition.

Thứ tự điều hướng chuẩn toàn hệ thống là `Brand → Visual → 3D → Game → Web → App`. Hai phím mũi tên của Portfolio phải đi theo đúng thứ tự dữ liệu này, không theo thứ tự tên công cụ cũ.

Rail desktop dùng sáu shortcut trang trí có chức năng: Photoshop → Visual, Illustrator → Brand, Blender → 3D, Unity → Game, VS Code → Web; Codex hiển thị trạng thái disabled/Coming soon. Không có shortcut App và nút Power cuối rail được giữ nguyên.

Không dùng index array làm id. Dimension phải lấy từ asset thật; không điền 1000×1000 cho mọi ảnh. Không import cả asset lớn thành base64 bundle, dùng path `./public/...`. Không `fetch('./data.json')` trong file://. Dùng import data TS tĩnh.

```ts
// app/portfolio/selectors.ts
import type { Project, Filter } from './types';
export const normalize = (text: string) => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
export function selectProjects(projects: Project[], category: Filter, query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  return projects.filter(p => p.status === 'published')
    .filter(p => category === 'all' || p.primaryCategory === category)
    .filter(p => {
      const haystack = normalize([p.title, p.summary, ...p.tags, ...(p.tools ?? [])].join(' '));
      return terms.every(term => haystack.includes(term));
    }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
```

Search dưới vài chục dự án không cần debounce timeout. Chỉ thêm `useDeferredValue` nếu đo được chậm; nếu có deferred results phải thông báo pending và không click stale result ngoài ý muốn.

```ts
// app/portfolio/navigation.ts
import type { Filter, Project } from './types';
type Results = { category: Filter; query: string; scrollTop: number };
export type State = Results & { projectId: string | null; back: Results | null };
export const initialState: State = {
  category: 'all', query: '', scrollTop: 0, projectId: null, back: null,
};
export type Action =
  | { type: 'category'; value: Filter }
  | { type: 'query'; value: string }
  | { type: 'open'; project: Project; scrollTop: number }
  | { type: 'back' };
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'category': return { ...initialState, category: action.value, query: state.query };
    case 'query': return { ...initialState, category: state.category, query: action.value };
    case 'open': return {
      category: action.project.primaryCategory, query: '', scrollTop: 0,
      projectId: action.project.id,
      back: state.projectId ? state.back : {
        category: state.category, query: state.query, scrollTop: action.scrollTop,
      },
    };
    case 'back': return { ...initialState, ...(state.back ?? {}) };
  }
}
```

Dispatch open kèm `viewerRef.current?.scrollTop ?? 0`. Sau thay route, dùng layout effect để set viewer.scrollTop về state.scrollTop; dependency gồm category, query, projectId, scrollTop. Không ghi scrollTop vào React state mỗi frame. Click category hiện tại phải reset về list đầu trang dù deps trùng: handler có thể set `viewerRef.current.scrollTop=0` trực tiếp. Focus heading mới bằng ref/tabIndex=-1 khi mở case study; Back trả focus về thumbnail nếu còn tồn tại, sau đó khôi phục scroll. Lưu ref/id focus riêng, không thêm vào Project data.

## 9. Component và CSS nền để lắp ráp

Khung DOM bắt buộc (các component con cần implement theo props phía dưới):

```tsx
<section className="pf-window" aria-label="Portfolio" data-searching={searchFocused}>
  <header className="pf-header">
    <label className="pf-search">
      <Search aria-hidden="true" />
      <input type="search" aria-label="Search portfolio" placeholder="Search projects…"
        value={state.query} onChange={e => dispatch({ type: 'query', value: e.target.value })}
        onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
    </label>
    <button className="pf-close" type="button" aria-label="Close portfolio" onClick={onClose}>
      <X aria-hidden="true" />
    </button>
  </header>
  <CategoryNav selected={state.category} onSelect={selectCategory} />
  <main ref={viewerRef} className="pf-viewer" aria-label="Portfolio content">
    {currentProject
      ? <CaseStudy project={currentProject} onBack={backToResults} onOpen={openProject} />
      : <Overview projects={visibleProjects} category={state.category} onOpen={openProject} />}
  </main>
  <ProjectIndex projects={visibleProjects} selectedId={state.projectId} onSelect={openProject} />
</section>
```

Đây là skeleton wiring, không paste standalone và kỳ vọng compile: định nghĩa `currentProject`, các handlers/ref và import component trước. Dùng published registry tìm currentProject, id không hợp lệ phải về results. Khi currentProject tồn tại, visibleProjects lấy category mới và query='' nên selected project luôn nằm trong list.

CategoryNav: `<nav className="pf-nav" aria-label="Portfolio categories">`; 7 button `aria-pressed`, `data-category`. ProjectIndex: `<aside className="pf-index" aria-label="Projects"><ul>…</ul></aside>`, mỗi li có button `aria-current={selected ? 'true' : undefined}`. Một DOM duy nhất cho mỗi nav/index để không có duplicate focusable controls giữa desktop/mobile.

```css
/* app/portfolio.css — append to build CSS sources after layouts.css */
.pf-window {
  --pf-line: var(--border);
  position: absolute; inset: 10px; z-index: 10;
  display: grid;
  grid-template-columns: 104px minmax(0,1fr) clamp(224px,21%,340px);
  grid-template-rows: 60px minmax(0,1fr);
  grid-template-areas: 'nav header header' 'nav viewer index';
  overflow: hidden; border: 1px solid var(--pf-line); border-radius: 24px;
  background: var(--panel); color: var(--ink);
  container-type: size;
}
.pf-window * { box-sizing: border-box; }
.pf-header {
  grid-area: header; display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; min-width: 0; border-bottom: 1px solid var(--pf-line);
  background: var(--panel); z-index: 2;
}
.pf-search { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.pf-search input {
  width: 100%; min-width: 0; height: 44px; font: inherit; font-size: 16px;
  background: var(--elevated); color: var(--ink); border: 1px solid var(--pf-line);
  border-radius: 12px; padding: 0 12px;
}
.pf-close { width:44px; height:44px; flex:0 0 44px; border-radius:50%; }
.pf-window button { color: inherit; cursor: pointer; font: inherit; }
.pf-close, .pf-nav button, .pf-index button {
  border: 1px solid transparent; background: var(--panel);
}
.pf-window button:focus-visible, .pf-search input:focus-visible {
  outline: 2px solid var(--rose-strong); outline-offset: -3px;
}
.pf-nav {
  grid-area: nav; min-height: 0; overflow-y:auto; display:flex;
  flex-direction:column; gap:8px; padding:12px 8px;
  border-right:1px solid var(--pf-line);
}
.pf-nav button { min-height:44px; padding:10px 4px; border-radius:12px; }
.pf-nav button[aria-pressed='true'] {
  background:var(--rose-strong); color:var(--on-accent);
}
.pf-nav [data-category='all'] { margin-block:12px; }
.pf-viewer {
  grid-area:viewer; min-height:0; min-width:0; overflow-y:auto; overflow-x:hidden;
  padding:24px; overscroll-behavior:contain; container-type:inline-size;
}
.pf-index { grid-area:index; min-height:0; min-width:0; overflow-y:auto; border-left:1px solid var(--pf-line); }
.pf-index ul { list-style:none; margin:0; padding:12px; display:grid; gap:8px; }
.pf-index button { width:100%; min-height:56px; text-align:left; border-radius:12px; }
.pf-index [aria-current='true'] { border-color:var(--rose-strong); background:var(--elevated); }
.pf-project-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; }
.pf-project-card { min-width:0; }
.pf-project-card img { display:block; width:100%; aspect-ratio:1; object-fit:cover; border-radius:16px; }
.pf-case img { display:block; width:100%; height:auto; }
.pf-case p { font-size:16px; line-height:1.6; max-width:70ch; }
@container (max-width:720px) { .pf-project-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@container (max-width:360px) { .pf-project-grid { grid-template-columns:1fr; } }
@media (hover:hover) {
  .pf-nav button:not([aria-pressed='true']):hover { background:var(--elevated); }
  .pf-index button:hover { background:var(--elevated); }
}
@media (min-width:821px) and (max-width:1199px) {
  .pf-window {
    grid-template-columns:88px minmax(0,1fr);
    grid-template-rows:56px 52px minmax(0,1fr);
    grid-template-areas:'nav header' 'nav index' 'nav viewer';
  }
  .pf-index { overflow-x:auto; overflow-y:hidden; border-left:0; }
  .pf-index ul { display:flex; padding:4px 8px; }
  .pf-index li { flex:0 0 180px; }
  .pf-index button { min-height:44px; }
}
@media (max-width:820px) {
  .pf-window {
    inset:7px; border-radius:20px; grid-template-columns:minmax(0,1fr);
    grid-template-rows:56px minmax(0,1fr) max(44px,5%) max(104px,20%);
    grid-template-areas:'header' 'viewer' 'index' 'nav';
  }
  .pf-viewer { padding:16px; }
  .pf-header { gap:8px; padding:6px 8px; }
  .pf-index { overflow-x:auto; overflow-y:hidden; border-left:0; border-top:1px solid var(--pf-line); }
  .pf-index ul { display:flex; height:100%; align-items:center; gap:8px; padding:0 8px; }
  .pf-index li { flex:0 0 156px; }
  .pf-index button { min-height:44px; }
  .pf-nav {
    display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(44px,1fr));
    gap:4px; padding:4px; border-right:0; border-top:1px solid var(--pf-line);
  }
  .pf-nav [data-category='all'] { grid-column:1; grid-row:1 / 3; margin:0; }
  .pf-nav [data-category='photoshop'] { grid-area:1 / 2; }
  .pf-nav [data-category='illustrator'] { grid-area:1 / 3; }
  .pf-nav [data-category='blender'] { grid-area:1 / 4; }
  .pf-nav [data-category='game'] { grid-area:2 / 2; }
  .pf-nav [data-category='web'] { grid-area:2 / 3; }
  .pf-nav [data-category='app'] { grid-area:2 / 4; }
  .pf-nav button { min-width:0; padding:4px 2px; font-size:12px; }
  .pf-window[data-searching='true'] { grid-template-rows:56px minmax(0,1fr); grid-template-areas:'header' 'viewer'; }
  .pf-window[data-searching='true'] .pf-nav,
  .pf-window[data-searching='true'] .pf-index { display:none; }
}
@media (max-width:820px) and (max-height:560px) {
  .pf-window { grid-template-rows:48px minmax(0,1fr) 44px 104px; }
  .pf-window[data-searching='true'] { grid-template-rows:48px minmax(0,1fr); }
  .pf-header { padding-block:2px; }
}
@media (prefers-reduced-motion:reduce) {
  .pf-window, .pf-window * { animation:none; transition:none; scroll-behavior:auto; }
}
```

CSS này cần hoàn thiện visual card typography/icon, không thay cho toàn bộ style. Nav minimum thực cần 2×44 + gap4 + padding8 + border1 =101px: công thức dùng min104px để không tạo overflow. Tỷ lệ được phép vượt mục tiêu trên màn hình nhỏ. Nếu thêm safe-area padding, tăng track cùng lượng; không cộng padding vào track bị khóa104px. Chọn `inset-block-end: max(7px, env(safe-area-inset-bottom))` cho window nếu shell chưa xử lý safe-area; không cộng safe-area hai lần.

Không dùng `cqh` để tính chiều cao pf-window theo chính nó. Track % ở grid dựa trên chiều cao window đã definite bởi inset. Có thể dùng ResizeObserver để xác định chiều cao khả dụng phục vụ chế độ bàn phím, nhưng không cần JS đo mọi hàng UI.

## 10. Tích hợp shell — hướng dẫn chính xác

1. Thêm `portfolio` vào View; migrate mọi `music` entry point tới nó trong cùng phase integration. Không chỉ đổi label.
2. Thêm prop `onOpenPortfolio` và `onClick` cho button `data-action="portfolio"`.
3. Render `<PortfolioApp initialCategory={entry.category} onClose={() => openView('desktop')} />` ở view tương ứng. Hero/launcher truyền `all`; shortcut rail truyền category tương ứng.
4. Lưu element mở cửa sổ vào ref trước open; close restore focus sau React render, fallback button Portfolio nếu element cũ mất. Phối hợp global Escape: chỉ một handler xử lý, input clear phải stopPropagation để không vừa clear vừa đóng.
5. Rà active-window label và icon; không còn “Paused/Reset/Tiger JK” khi xem Portfolio.
6. Rà launcher, phím tắt, state playing, media overlay. Xóa MusicApp/AlbumCard/data âm nhạc chỉ khi `rg` xác nhận không consumer. Xóa lucide import dư sau TypeScript check.
7. Thêm portfolio.css vào CSS source list trong build.mjs. Nếu import CSS trực tiếp qua esbuild mà không sửa pipeline hiện tại có thể mất style: phải verify output assets/app.css.
8. Giữ theme id và localStorage `hyperd-layout`. Không introduce portfolio theme storage riêng.
9. Khi click external demo/repo dùng anchor thật, `rel="noopener noreferrer"` với target blank; không mở arbitrary URL từ user input. Không giả button download khi chưa có file.

## 11. Task triển khai theo phase

### P0 — Chốt baseline (read-only)

- Đọc master, git status và hướng dẫn AGENTS nếu có; ghi các file đang dirty, bảo toàn công việc khác.
- Chụp MusicApp + CV + hero hiện tại ở desktop/mobile nếu browser được phép.
- Đo chiều rộng viewer và panel track-list, chiều cao cửa sổ mobile; xác nhận token/font nguồn.
- Đọc data assets thật, dimensions, alpha; không sửa ảnh nếu chỉ cần dùng lại.
- Done: baseline ghi vào `design-system/portfolio-progress.md`; không “reset sạch” repo.

### P1 — Data/state/components cơ bản

- Types, registry, category mapping, reducer, selectors.
- Hoàn thiện dataset hai artwork đã xác nhận; booth draft nếu tool chưa xác nhận. Không publish case study rỗng với nội dung suy đoán.
- Components chỉ render trong nhánh Portfolio; không thay MusicApp sớm để một nửa app lỗi.
- Done: type-check, unit test selector/reducer có ý nghĩa; không tạo test chỉ kiểm tra class string.

### P2 — Khung responsive và entry point

- Header X/search ngoài scroll, viewer và index/nav đúng grid; bỏ player.
- Nối Portfolio hero/rail/launcher, Escape/focus; migrate tests cũ.
- Done: mở/đóng, mặc định All, cuộn không kéo X, mobile không ngang viewport.

### P3 — Overview/category/case study

- Hyper Design + Hyper Development, thumbnail real, no-result và empty category.
- Section renderer đầy đủ; media intrinsic ratio; captions đọc được; no forced full-height hero.
- Click card đồng bộ category + index. Back restore filter/query/scroll.
- Done: cùng một nguồn filtered list ở center/index; không stale selection.

### P4 — Mobile và accessibility

- Dock mục tiêu25%, hai hàng Design/Dev + All; strip native ngang.
- Bàn phím, safe-area, landscape, text zoom, focus/trap hoặc inert nền theo kiến trúc overlay thực tế.
- Nếu dùng role=dialog aria-modal=true thì bắt buộc implement focus trap + inert nền + return focus. Nếu chưa implement không tự gắn aria-modal=true để giả accessibility.
- Done: không có control bị che, không có vùng trắng do margin âm, mọi dự án đọc tới cuối.

### P5 — QA trực quan, dọn và bàn giao

- Build/test, static file paths + GitHub subpath.
- So sánh screenshot từng breakpoint/theme và đầu/cuối case study, có đo bounding boxes nếu tooling cho phép.
- Chỉ dọn CSS/music imports không còn consumer; không xóa asset người dùng.
- Done: bằng chứng QA và known issues ghi rõ. Test DOM pass không chứng minh UI đẹp hoặc không overflow.

Mỗi phase cập nhật progress file: completed tasks, changed files, evidence, unresolved decisions, next step. Task sau đọc master+progress trước khi làm. Không mở task mới hoặc giao agent nếu người dùng chưa yêu cầu.

## 12. Verification matrix và acceptance criteria

| Viewport | Điều cần kiểm |
| --- | --- |
| 1920×1080 | 3 cột; index hẹp hơn; center rộng; không có player; header/X cố định. |
| 1440×900 | Các nhãn không đè; thumbnail ít nhất2 cột tùy viewer; full project đọc được. |
| 1024×768 | Tablet nav trái + project strip phía trên; không mất danh sách vì display:none cũ. |
| 820×1180 | Mobile layout tại breakpoint; không cùng lúc hai nav. |
| 390×844 và 375×667 | Shell rail trừ đúng bề ngang; dock≈25% có minimum; X/search đủ lớn. |
| 320×568 | 1 cột thumbnail; button chữ ngắn không tràn; nội dung16px vẫn đọc được. |
| 844×390 | Layout landscape thực tế phải hữu dụng: tablet rule theo width có thể nav trái, header56/index52, viewer còn đủ; kiểm tra viewport height thực. |
| Zoom200%, bàn phím mở | Không che search/X, có thể cuộn hết nội dung, dock không chiếm hết vùng đọc. |

Themes: Paper, Graphite, Blueprint, Sage, Code Lab (id gallery). Contrast body≥4.5:1, focus/control≥3:1; title/logo không biến mất vì màu hardcode trắng. Screen reader đọc nav, search, current project đúng thứ tự. Hàng mobile visual Design/Dev phải khớp thứ tự DOM: Design→All→Dev là chấp nhận nếu All announced rõ; cân nhắc DOM All→Design→Dev với CSS desktop reposition để keyboard dễ hiểu, test trước chốt.

Tình huống bắt buộc:

- Open từ3 entry points; All active duy nhất.
- Click Coco Boba Poster → Visual active, đúng artwork, không còn audio controls.
- Hover Brand khi Visual active: không thành hai active pills.
- Search tiếng Việt có/không dấu, tên tool, không kết quả; clear/query reset đúng.
- Cuộn case dài xuống đáy; X/header/dock còn đúng góc; last section không dưới dock.
- Swipe index không tự mở item; tap mở đúng; active item được đưa vào tầm nhìn ngang mà không cuộn viewer (dùng scrollTo trên index container, tránh scrollIntoView cuộn ancestor ngoài ý muốn).
- Click category rỗng không crash; nhấn Back từ project phục hồi vị trí thumbnail.
- Mở lại sau close reset All. About/hero/layout picker giữ hành vi cũ.
- Broken media: fallback có alt/caption và retry/open link hợp lý, không lặp onError vô hạn.
- Video không autoplay có tiếng; offscreen pause/unmount cleanup.
- Reduced motion: nội dung luôn hiện, không opacity0 chờ animation event.

Commands gợi ý: `npm run check`, `npm test`. Nếu esbuild spawn EPERM, dùng cơ chế escalation chính thức. Không sửa generated bundles để né build.

Browser kiểm tra file:// đã từng bị policy chặn trong thread này. Không lách bằng raw CDP, browser khác hoặc chạy server chỉ để vượt lệnh chặn. Nếu vẫn bị chặn, ghi rõ chưa QA trực quan; dùng screenshot người dùng khi có. Không ghi “pixel perfect” hoặc “vừa màn hình đã xác nhận” dựa vào jsdom.

## 13. Điều chưa được tự mở rộng

- Không backend/CMS/login/upload public, không deployment/GitHub push trong phase này.
- Không thêm GSAP, router, carousel package chỉ để tạo chuyển cảnh.
- Không biến link portfolio thành file PDF CV; đó là chức năng khác.
- Không tự generate portfolio khách hàng, before/after hoặc metrics.
- Không đổi tên category/filter ID tùy theme.
- Không “đầy đặn” bằng tăng height card rỗng hoặc tạo slot giả.
- Tỷ lệ dock điều chỉnh theo khả dụng được phép; thay kiến trúc sáu category/two-row nav cần hỏi người dùng.

## 14. Prompt tiếp nối có thể dùng nguyên văn

“Đọc design-system/PORTFOLIO-MASTER.md và portfolio-progress.md nếu có. Thực hiện P0–P2 trước, bảo toàn thay đổi khác. Dùng UI UX Pro Max theo quyết định đã chốt. Xây PortfolioApp tách module, nối hero Portfolio, category All mặc định, X/search ngoài vùng scroll, desktop 3 cột và mobile dock 2 hàng. Chỉ All hiển thị lobby; mọi category chuyên môn mở thẳng project đầu tiên. Không tự bịa dự án, không sửa CV/layout picker. Sau đó tiếp tục P3–P5 nếu không có blocker; báo bằng chứng và giới hạn QA thực tế. Không dừng chỉ ở skeleton khi đã được yêu cầu triển khai toàn bộ.”

## 15. Definition of Done cuối cùng

Hoàn tất khi người dùng có thể mở Portfolio từ trang chính, duyệt/phân loại/tìm dự án thật, xem case study dài, quay về đúng danh sách, đóng mọi lúc trên desktop/mobile; không có player cũ trong cửa sổ; các theme hoạt động; mọi asset load qua file:// và GitHub subpath; kiểm tra trực quan có bằng chứng hoặc giới hạn được báo rõ. Tài liệu này tự nó chỉ hoàn tất yêu cầu LÊN KẾ HOẠCH, không có nghĩa chức năng đã được xây.

## 16. User override — direct category routing (2026-09-11)

Phần này thay thế mọi mô tả luồng category cũ ở phía trên:

- Nhãn tổng quan hiển thị bằng tiếng Anh là `All`, không dùng `Tổng hợp` trong UI.
- Chỉ `All` có giao diện lobby/overview gồm featured project và các hàng Hyper Design / Hyper Development.
- Click Brand, Visual, 3D, Game, Web hoặc App phải mở thẳng project đầu tiên của category đó ở chế độ case study. Không render một lobby thu nhỏ hoặc bắt người dùng chọn project thêm lần nữa.
- Nút Back trong case study luôn trở về lobby `All`. Search cũng trả giao diện về `All` trước khi lọc để kết quả đa category có ngữ cảnh nhất quán.
- Category chưa có dữ liệu thật dùng đúng một project placeholder trung thực (không metrics, không nội dung giả) để vẫn có đích đến trực tiếp; thay placeholder bằng project thật trong registry khi asset được cung cấp.
- Typography nội bộ Portfolio dùng Google Sans Flex/sans-serif hiện có. Không dùng Designer cho section heading, case title hoặc số Project index; Designer chỉ được giữ ở vùng nhận diện thương hiệu khác nếu có chủ đích riêng.
- Mobile dock giữ hai hàng rõ nhóm: Brand/Visual/3D ở hàng Design, Game/Web/App ở hàng Development; `All` là control trung tâm riêng nhưng không được chiếm một mảng lớn làm lệch bố cục.
