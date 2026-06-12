/* =========================================================================
   ⚙️ [app.js] PKB71 의류 전문 미니멀 쇼핑몰 실시간 연동 코어 엔진 (4차 최종 마스터 완전체 + ⏱️초고속 타임아웃 + 🛡️이중 Fail-safe 방어막)
   =========================================================================
   🛡️ [4차 긴급 최적화 - 로컬 구동 file:// 보안 예외 완벽 무력화 탑재]:
   - 대표님이 바탕화면의 HTML 파일을 직접 더블클릭(file:// 프로토콜)하여 구동하는 환경에서는
     크롬 등 현대 브라우저의 보안 제약(Local Storage 접근 차단, 쿠키 제한)으로 인해
     자바스크립트 내부에서 SecurityError(Access Denied) 또는 ReferenceError(Supabase 미정의)가 터지며
     스크립트 전체가 멈춰 로딩창이 영원히 도는 치명적인 버그가 발생할 수 있습니다.
   
   - 이를 100% 해결하기 위해 아래의 **이중 Fail-safe 방어막**을 탑재했습니다:
     1. **safeLocalStorage 래퍼 장착**: 브라우저 보안에 의해 localStorage가 차단당해도, 스크립트 실행이 중단되지 않고 가상의 임시 메모리 변수(In-Memory)로 자동 긴급 우회 복구되어 구동되도록 차단막 처리.
     2. **typeof supabase 미정의 방어막 장착**: Supabase 라이브러리가 인터넷 지연으로 미처 로드되지 않은 0.1초 찰나에 발생할 수 있는 모든 정의되지 않은 에러를 원천 사전 차단.
   ========================================================================= */

// 🔒 [대표님의 고유 Supabase 클라우드 보안 연결 정보 세팅]
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your-key-here";

// 🔑 대표님 관리 오피스 비밀번호 기본값 세팅 (비밀번호 원글인 "1234"의 SHA-256 해시값)
const ADMIN_PASSWORD_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";

// 🛡️ [보안 고도화] 로컬스토리지 및 데이터베이스 내 개인정보 안전 암호화를 위한 비밀 보조 키
const LOCAL_STORAGE_SECRET = "pkb71_local_secure_key_9982";

/**
 * 🛡️ [신설] 데이터 전송 및 저장 전 안전한 암호화 수행 헬퍼 함수 (AES 알고리즘 적용)
 * @param {string} plainText - 암호화할 원본 텍스트
 * @returns {string} - 암호화된 복잡한 텍스트 값
 */
function secureEncrypt(plainText) {
    if (plainText === null || plainText === undefined) return "";
    const str = String(plainText).trim();
    if (!str) return "";
    try {
        // CryptoJS AES 알고리즘을 사용해 대표님 고유 키값으로 암호화하여 텍스트로 반환합니다.
        return CryptoJS.AES.encrypt(str, LOCAL_STORAGE_SECRET).toString();
    } catch (e) {
        console.error("🔒 [암호화 에러] 데이터 암호화 중 예외가 발생했습니다:", e);
        return plainText; // 에러 발생 시 최후의 수단으로 원본 반환 (서비스 무중단 보장)
    }
}

/**
 * 🛡️ [신설] 암호화된 데이터를 대표님 화면 및 고객 마이페이지에 보여주기 위한 복호화 헬퍼 함수
 * @param {string} cipherText - 암호화된 텍스트
 * @returns {string} - 복호화 복원된 깨끗한 한글/영문 텍스트
 */
function secureDecrypt(cipherText) {
    if (!cipherText) return "";
    try {
        // CryptoJS AES 복호화를 기동합니다.
        const bytes = CryptoJS.AES.decrypt(String(cipherText).trim(), LOCAL_STORAGE_SECRET);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        // 복호화 결과물이 비어있지 않다면 정상 반환하고, 실패했을 경우(기존 평문 데이터) 원본을 반환합니다.
        return decrypted ? decrypted : cipherText;
    } catch (e) {
        // 복호화 과정에서 예외가 나는 경우는 이미 평문 상태인 데이터이거나 손상된 데이터이므로 원본을 반환합니다.
        return cipherText;
    }
}

// 🛡️ [신설] 로컬 구동 file:// 보안 제약에 의한 브라우저 로컬스토리지 차단 에러 완벽 방어막 (Fail-safe)
// - 개인정보가 저장되는 프로필(pkb71_mock_profile) 및 회원 리스트(pkb71_users)에 대해 CryptoJS AES 자동 암복호화를 투명하게 이식합니다.
const safeLocalStorage = {
    getItem: function(key) {
        try {
            const rawValue = localStorage.getItem(key);
            if (!rawValue) return null;
            
            // 민감 개인정보 키가 반환될 경우 복호화 자동 필터링
            if (key === "pkb71_mock_profile" || key === "pkb71_users") {
                try {
                    const bytes = CryptoJS.AES.decrypt(rawValue, LOCAL_STORAGE_SECRET);
                    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                    if (decrypted) return decrypted;
                } catch (decErr) {
                    // 과거 평문 데이터와의 호환성을 고려하여 복호화 실패 시 기존 평문 데이터를 그대로 복구해 줍니다.
                    return rawValue;
                }
            }
            return rawValue;
        } catch(e) {
            console.warn("⚠️ 브라우저 보안 제약으로 localStorage 접근 차단됨 (임시 가상 메모리로 대체 기동):", e.message);
            return this[key] || null;
        }
    },
    setItem: function(key, value) {
        try {
            let valueToStore = value;
            
            // 민감 개인정보 저장 시 암호화 처리 후 스토리지 기록
            if (key === "pkb71_mock_profile" || key === "pkb71_users") {
                if (value) {
                    valueToStore = CryptoJS.AES.encrypt(value, LOCAL_STORAGE_SECRET).toString();
                }
            }
            localStorage.setItem(key, valueToStore);
        } catch(e) {
            console.warn("⚠️ 브라우저 보안 제약으로 localStorage 저장 차단됨 (임시 가상 메모리로 대체 기동):", e.message);
            this[key] = value;
        }
    },
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
        } catch(e) {
            delete this[key];
        }
    }
};

// 전역 상태 변수들
let supabaseClient = null;
let currentUser = null;       // 로그인된 현재 사용자 객체
let userProfile = null;      // 로그인된 회원의 profiles 정보 (이름, 연락처, 주소, 적립금)
let allProducts = [];        // 전체 진열 상품 배열
let currentProduct = null;   // 현재 상세뷰어로 보는 단일 상품
let selectedColor = "";      // 선택된 상품 옵션 (색상)
let selectedSize = "";       // 선택된 상품 옵션 (사이즈)
let selectedOptions = [];    // 🌟 [아울렛몰.shop 스타일] 상세페이지에서 동적으로 선택한 다중 옵션 리스트 배열

// 🛒 장바구니 상태 관리
let cart = [];

// 다차원 필터용 전역 변수
let searchQuery = "";
let currentCategory = "All";
let currentSort = "latest";
let selectedBrand = "";
let currentPage = 1;
const itemsPerPage = 30; // 5열 기준 6줄 정렬

// 🏷️ [계층형 카테고리 고도화] 대/중/소 계층형 카테고리 필터 상태 변수 신설
let currentCategoryLarge = "All"; // 대분류 선택 상태 (한글 카테고리명 또는 "All")
let currentCategoryMedium = "";   // 중분류 선택 상태 (한글 카테고리명)
let currentCategorySmall = "";    // 소분류 선택 상태 (한글 카테고리명)

// Q&A 게시판 로컬/실시간 데이터
let qnaPosts = [];

// 찜하기(Wishlist) 및 최근 본 상품 전역 리스트
let wishlist = [];
let recentViewed = [];

// 대표님 전용 현재 활성화된 관리실 탭
let activeAdminTab = "products";

// 🌟 [지능형 더미 데이터 - 상품 컬렉션] 🌟
const DUMMY_PRODUCTS = [
    {
        id: "dummy-1",
        post_id: "post_11111",
        post_url: "https://band.us",
        brand: "Loro Piana (로로피아나)",
        name: "캐시미어 린넨 혼방 오버핏 드레이프 셔츠",
        original_price: "$45",
        selling_price: 141000,
        colors: ["샌드베이지", "오프화이트", "차콜그레이"],
        sizes: ["M 95", "L 100", "XL 105"],
        details: "🧵 [내추럴 하이엔드 셀렉션] 본 제품은 자연스럽고 우우하게 흐르는 실루엣을 극대화하기 위해 최고급 캐시미어 린넨 혼방 원사로 편직되었습니다. 한 계절이 지나도 늘어남 없는 짱짱한 마감을 자랑합니다.",
        image_urls: [
            "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800",
            "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800"
        ],
        is_visible: true
    },
    {
        id: "dummy-2",
        post_id: "post_22222",
        post_url: "https://band.us",
        brand: "Brunello Cucinelli (쿠치넬리)",
        name: "코튼 스판 밴딩 와이드 슬랙스",
        original_price: "$40",
        selling_price: 127000,
        colors: ["네이비블랙", "크림베이지"],
        sizes: ["30 M", "32 L", "34 XL"],
        details: "👔 [데일리 릴렉스 실루엣] 고탄력 유연 스판 원단이 혼방되어 입은 듯 안 입은 듯 최상의 편안함을 선사하는 명품 핏 밴딩 슬랙스입니다. 고급 스팀 링클프리 처리가 되어 구김에 아주 강합니다.",
        image_urls: [
            "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800",
            "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800"
        ],
        is_visible: true
    },
    {
        id: "dummy-3",
        post_id: "post_33333",
        post_url: "https://band.us",
        brand: "G FORE (지포어)",
        name: "자카드 메쉬 프리미엄 남성 골프 피케 셔츠",
        original_price: "$50",
        selling_price: 155000,
        colors: ["스카이블루", "퓨어화이트"],
        sizes: ["95 M", "100 L", "105 XL"],
        details: "⛳ [초경량 고신축 라운딩 피케] 한여름 필드 위에서도 극강의 쾌적함을 보장하기 위해 최고급 자카드 메쉬 통풍 원단을 사용했습니다. 어깨 스윙 시 걸림 없는 인체공학적 무봉제 테이핑 기법 적용.",
        image_urls: [
            "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800",
            "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800"
        ],
        is_visible: true
    },
    {
        id: "dummy-4",
        post_id: "post_44444",
        post_url: "https://band.us",
        brand: "HERMES (에르메스)",
        name: "쁘띠 아쉬 실크 포켓 가죽 토트백",
        original_price: "$120",
        selling_price: 389000,
        colors: ["에토프", "블랙골드"],
        sizes: ["One Size"],
        details: "👜 [쁘띠 아쉬 익스클루시브] 명품 천연 고트스킨 가죽의 질감을 그대로 살려 튼튼하면서도 극도로 부드러운 하이엔드 가방입니다. 내부 포켓에는 고급 실크 원사를 활용한 포인트를 주어 수려함을 뽐냅니다.",
        image_urls: [
            "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800"
        ],
        is_visible: false
    }
];

// 🌟 [주문서 대장 지능형 더미 장부] 🌟
const DUMMY_ORDERS = [
    {
        id: "order-1",
        order_no: "ORD-20260531-772948",
        customer_name: "홍길동",
        phone: "010-1234-5678",
        postcode: "06035",
        address: "서울 강남구 가로수길 45",
        address_detail: "명품 빌딩 302호",
        message: "부재 시 문 앞에 놓아주세요.",
        depositor: "홍길동",
        total_amount: 268000,
        items: [
            { prodId: "dummy-1", name: "캐시미어 린넨 혼방 오버핏 드레이프 셔츠", color: "샌드베이지", size: "L 100", qty: 1, price: 141000, thumb: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=100" },
            { prodId: "dummy-2", name: "코튼 스판 밴딩 와이드 슬랙스", color: "크림베이지", size: "32 L", qty: 1, price: 127000, thumb: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=100" }
        ],
        status: "결제완료",
        user_id: "mock-user-123",
        created_at: "2026-05-31T03:30:00.000Z"
    }
];

// 🌟 [Q&A 간편 게시판 지능형 더미 목록] 🌟
const DUMMY_QNA = [
    {
        id: "qna-1",
        title: "로로피아나 셔츠 사이즈 문의드립니다.",
        author: "최재훈",
        content: "키 178cm에 몸무게 74kg 정도 나가는데 셔츠 L 사이즈 입으면 품이 넉넉할까요? 오버핏을 좋아해서 적절히 연출하고 싶습니다.",
        is_secret: false,
        password: null,
        reply: "안녕하세요 재훈 고객님! pkb71 셀렉션입니다. 178/74 스펙이시라면 L(100) 사이즈 주문 시 과하게 벙벙하지 않고 몸에 아주 우아하게 떨어지는 클래식 세미오버핏 드레이프가 완벽히 나옵니다! 한 치수 더 오버한 핏을 진정으로 원하신다면 XL도 추천하나 본래 패턴 자체가 넉넉하여 L을 강력히 추천 드립니다. 🧥✨",
        reply_created_at: "2026-05-31T04:10:00.000Z",
        created_at: "2026-05-31T03:45:00.000Z"
    }
];

// 🌟 [포토/텍스트 리뷰 만족 후기 지능형 더미 목록] 🌟
const DUMMY_REVIEWS = [
    {
        id: "review-1",
        prod_id: "dummy-1",
        user_id: "mock-user-123",
        order_no: "ORD-20260531-772948",
        author: "최영주",
        rating: 5,
        content: "재질이 정말 예술이네요. 로로피아나 감성 오버핏이 수려하게 떨어지고 첫눈에 원단 퀄리티가 다르다는걸 알 수 있습니다. 세탁 가이드대로 드라이크리닝 꼼꼼히 맡겨서 평생 소장할 생각입니다. 적극 추천해요!",
        image_url: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=200",
        created_at: "2026-05-31T04:00:00.000Z"
    },
    {
        id: "review-2",
        prod_id: "dummy-2",
        user_id: "mock-user-456",
        order_no: "ORD-20260531-104928",
        author: "강성민",
        rating: 4,
        content: "슬랙스 허리 밴딩 처리가 최고입니다. 입은듯 안입은듯 아주 편안한 스판재질인데 구김이 안가네요. 출퇴근용 데일리 웨어로 딱입니다.",
        image_url: null,
        created_at: "2026-05-31T04:20:00.000Z"
    }
];

// 로컬 스토리지 기반 4차 리뷰 임시 보관함
let localReviews = [];

// 👥 [신설 5차 고도화] 회원 profiles 지능형 더미 명단
const DUMMY_USERS = [
    { id: "mock-user-123", email: "gildong@pkb71.com", name: "홍길동", phone: "010-1234-5678", postcode: "06035", address: "서울 강남구 가로수길 45", address_detail: "명품 빌딩 302호", points: 3000, created_at: "2026-05-01T12:00:00.000Z" },
    { id: "mock-user-456", email: "sungmin@naver.com", name: "강성민", phone: "010-9988-7766", postcode: "06035", address: "서울 강남구 압구정로 201", address_detail: "현대아파트 80동 1102호", points: 5000, created_at: "2026-05-15T09:30:00.000Z" },
    { id: "mock-user-789", email: "youngju@gmail.com", name: "최영주", phone: "010-5544-3322", postcode: "04524", address: "서울 중구 세종대로 110", address_detail: "서울시청빌딩 12층", points: 1500, created_at: "2026-05-20T14:45:00.000Z" }
];

// 로컬 스토리지 기반 5차 가상 회원 임시 보관함
let localUsers = [];

// 🏷️ [신설 6차 고도화] 동적 상품 분류 카테고리 4대 디폴트 목록 (대/중/소 3단계 계층 구조)
const DEFAULT_CATEGORIES = [
    // 대분류 (depth = 0, parent_id = null)
    { id: "cat-large-1", name: "여성의류", eng_name: "WOMEN", depth: 0, parent_id: null, created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-large-2", name: "남성의류", eng_name: "MEN", depth: 0, parent_id: null, created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-large-3", name: "럭셔리잡화", eng_name: "ACCESSORIES", depth: 0, parent_id: null, created_at: "2026-05-01T12:00:00.000Z" },
    
    // 중분류 (depth = 1, parent_id = 대분류 ID)
    { id: "cat-medium-1", name: "아우터", eng_name: "OUTER", depth: 1, parent_id: "cat-large-1", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-medium-2", name: "상의/원피스", eng_name: "TOPS_DRESS", depth: 1, parent_id: "cat-large-1", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-medium-3", name: "상의", eng_name: "TOPS", depth: 1, parent_id: "cat-large-2", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-medium-4", name: "하의", eng_name: "BOTTOMS", depth: 1, parent_id: "cat-large-2", created_at: "2026-05-01T12:00:00.000Z" },
    
    // 소분류 (depth = 2, parent_id = 중분류 ID)
    { id: "cat-small-1", name: "자켓", eng_name: "JACKETS", depth: 2, parent_id: "cat-medium-1", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-small-2", name: "코트", eng_name: "COATS", depth: 2, parent_id: "cat-medium-1", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-small-3", name: "셔츠", eng_name: "SHIRTS", depth: 2, parent_id: "cat-medium-3", created_at: "2026-05-01T12:00:00.000Z" },
    { id: "cat-small-4", name: "슬랙스", eng_name: "PANTS", depth: 2, parent_id: "cat-medium-4", created_at: "2026-05-01T12:00:00.000Z" }
];

// 로컬 스토리지 기반 6차 가상 카테고리 임시 보관함
let localCategories = [];

// 📦 [신설 6차 고도화] 수동 등록 시 대표님이 올린 컴퓨터 이미지 파일들의 Base64 리스트 보관소
let manualUploadedImages = [];

// 📢 [신설 5차 고도화] 공지사항 및 이벤트 전역 리스트 보관소 및 지능형 더미 데이터셋
let localNotices = [];
const DEFAULT_NOTICES = [
    {
        id: "notice-1",
        type: "notice",
        title: "OUTLETMALL 정식 그랜드 론칭 안내 (www.아울렛몰.com)",
        content: "안녕하세요, OUTLETMALL VIP 회원 여러분.\n\n엄선된 3대 명품 골프, 의류, 잡화 직수입 프리미엄 셀렉션 몰인 [아울렛몰.com]이 정식 론칭되었습니다.\n\n공급처 네이버 밴드와 실시간 연계되어 최고급 퀄리티의 신상을 매일 오전 실시간 업데이트합니다. 최상의 서비스를 보장해 드리겠습니다.\n\n감사합니다. 🧥⛳👜",
        created_at: "2026-05-31T09:00:00.000Z"
    },
    {
        id: "notice-2",
        type: "event",
        title: "🎉 신규 가입 VIP 고객 3,000원 웰컴 적립금 즉시 지급 이벤트",
        content: "아울렛몰 그랜드 오픈 기념 스페셜 혜택!\n\n지금 간편 가입 양식을 통해 JOIN US 해주신 모든 VIP 회원분들께 구매 시 즉시 사용이 가능한 [웰컴 적립금 3,000원]을 즉시 적립해 드립니다.\n\n마이페이지에서 적립금 잔액을 실시간 확인하시고 합리적인 명품 쇼핑을 즐겨보세요! 🎁✨",
        created_at: "2026-05-31T09:30:00.000Z"
    }
];

// =========================================================================
// ⏱️ Graceful Timeout Recovery - 초고속 비동기 타임아웃 보호 래퍼
// =========================================================================
function timeoutPromise(ms, promise) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error("NETWORK_TIMEOUT_LIMIT_EXCEEDED"));
        }, ms);
        
        promise.then(
            res => {
                clearTimeout(timer);
                resolve(res);
            },
            err => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
}

// 🛡️ [보안 고도화] XSS(교차 사이트 스크립팅) 방지를 위한 전역 HTML escape 헬퍼 함수
function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========================================================================
// 1. [초기 설정 및 브레인 기동]
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initSupabase();
    loadCartFromStorage();
    loadWishlistFromStorage();
    loadRecentViewedFromStorage();
    fetchProducts();
    fetchQnaPosts();
    injectDaumPostcodeScript();
    
    // 🛡️ [신설] 대표님 전용 비밀 관리실 진입 게이트웨이 (URL 주소창 제어)
    // - 로컬 구동 환경에서는 브라우저 및 윈도우 OS의 특성에 따라 ?admin 쿼리가 유실되는 일이 잦습니다.
    // - 이를 방지하기 위해 ?admin(쿼리)과 #admin(해시) 방식을 이중으로 완벽하게 감지하도록 Fail-safe를 적용했습니다.
    const urlParams = new URLSearchParams(window.location.search);
    const hasAdminQuery = urlParams.has('admin');
    const hasAdminHash = window.location.hash.includes('admin');
    
    if (hasAdminQuery || hasAdminHash) {
        setTimeout(() => {
            navigateTo('admin');
        }, 200);
    } else {
        syncFloatingControlMenu('home');
    }
    
    try {
        const savedRev = safeLocalStorage.getItem("pkb71_reviews");
        if (savedRev) localReviews = JSON.parse(savedRev);
    } catch(e) {}
    
    // 👥 [신설 5차 고객 관리] 가상 회원 로컬 저장 동기화
    try {
        const savedUsers = safeLocalStorage.getItem("pkb71_users");
        if (savedUsers) {
            localUsers = JSON.parse(savedUsers);
        } else {
            localUsers = [...DUMMY_USERS];
            safeLocalStorage.setItem("pkb71_users", JSON.stringify(localUsers));
        }
    } catch(e) {
        localUsers = [...DUMMY_USERS];
    }

    // 🏷️ [신설 6차 카테고리 관리] 가상 카테고리 로컬 저장 동기화 및 최초 기동
    try {
        const savedCats = safeLocalStorage.getItem("pkb71_categories");
        if (savedCats) {
            localCategories = JSON.parse(savedCats);
        } else {
            localCategories = [...DEFAULT_CATEGORIES];
            safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        }
    } catch(e) {
        localCategories = [...DEFAULT_CATEGORIES];
    }
    
    // 📢 [신설 5차 공지사항/이벤트] 가상 공지/이벤트 로컬 저장 동기화 및 최초 기동
    try {
        const savedNotices = safeLocalStorage.getItem("pkb71_notices");
        if (savedNotices) {
            localNotices = JSON.parse(savedNotices);
        } else {
            localNotices = [...DEFAULT_NOTICES];
            safeLocalStorage.setItem("pkb71_notices", JSON.stringify(localNotices));
        }
    } catch(e) {
        localNotices = [...DEFAULT_NOTICES];
    }
    
    renderShopCategoryTabs(); // 고객용 쇼핑몰 메인 카테고리 탭 렌더링 기동!
    
    // ⏱️ [신설] 앱 기동 시 메인 히어로 2페이지 페이드 캐러셀 타이머 엔진 시작
    startHeroTimer();
});

// Supabase 클라이언트 초기화 및 실시간 인증 세션 모니터링 (typeof 미정의 철저 우회 보호막 장착)
function initSupabase() {
    if (typeof supabase !== "undefined" && SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes("your-project")) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("✅ Supabase 클라우드 데이터베이스 및 인증엔진 정식 탑재!");
            
            supabaseClient.auth.onAuthStateChange(async (event, session) => {
                if (session) {
                    currentUser = session.user;
                    console.log("🔓 로그인 감지됨:", currentUser.email);
                    await fetchUserProfile();
                } else {
                    currentUser = null;
                    userProfile = null;
                    console.log("🔒 로그아웃 감지됨");
                }
                updateHeaderAuthUI();
                renderRecentQuickBar();
            });
        } catch (e) {
            console.warn("⚠️ Supabase 초기화 오류 (지능형 더미 모드 자동 가동):", e);
        }
    } else {
        console.log("👉 Supabase 미연동: 대표님 체험용 명품 더미 모드로 안전 작동 중입니다.");
        
        const mockUser = safeLocalStorage.getItem("pkb71_mock_user");
        if (mockUser) {
            currentUser = JSON.parse(mockUser);
            const mockProfile = safeLocalStorage.getItem("pkb71_mock_profile");
            if (mockProfile) {
                userProfile = JSON.parse(mockProfile);
            }
        }
        updateHeaderAuthUI();
        renderRecentQuickBar();
    }
}

function updateHeaderAuthUI() {
    const guestMenu = document.getElementById("header-guest-menu");
    const userMenu = document.getElementById("header-user-menu");
    const loginNotice = document.getElementById("checkout-login-notice");
    
    if (currentUser) {
        if (guestMenu) guestMenu.style.display = "none";
        // 🌟 [레이아웃 보정] 최상단 네비바 flex 레이아웃에서 span이 정렬을 방해하지 않도록 contents로 처리합니다.
        if (userMenu) userMenu.style.display = "contents";
        
        const points = userProfile?.points !== undefined ? userProfile.points : 3000;
        if (loginNotice) {
            loginNotice.innerHTML = `✨ <b>${userProfile?.name || currentUser.email.split('@')[0]}</b>님 환영합니다! (보유적립금: <b>${points.toLocaleString()}원</b> 자동 적용 가능)`;
        }
    } else {
        // 🌟 [레이아웃 보정] 최상단 네비바 flex 레이아웃에서 span이 정렬을 방해하지 않도록 contents로 처리합니다.
        if (guestMenu) guestMenu.style.display = "contents";
        if (userMenu) userMenu.style.display = "none";
        if (loginNotice) {
            loginNotice.innerHTML = `💡 로그인 시 등록된 배송 정보가 자동으로 입력됩니다!`;
        }
    }
}

function showToastMessage() {
    const toast = document.getElementById("save-toast");
    if (toast) {
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 2500);
    }
}

// =========================================================================
// 9. [🔄 SPA 단독 라우터 및 뷰 제어]
// =========================================================================
function syncFloatingControlMenu(page) {
    const floatingControlMenu = document.querySelector(".floating-control-menu");
    if (!floatingControlMenu) return;

    if (floatingControlMenu.parentElement && floatingControlMenu.parentElement.id === "view-admin") {
        document.body.appendChild(floatingControlMenu);
    }

    const adminView = document.getElementById("view-admin");
    const isAdminPage = page === "admin" || (adminView && adminView.style.display !== "none");
    floatingControlMenu.style.display = isAdminPage ? "none" : "flex";
}

function syncFloatingControlMenuFromLocation() {
    const isAdminUrl = new URLSearchParams(window.location.search).has("admin") || window.location.hash.includes("admin");
    syncFloatingControlMenu(isAdminUrl ? "admin" : "home");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncFloatingControlMenuFromLocation, { once: true });
} else {
    syncFloatingControlMenuFromLocation();
}

function navigateTo(page) {
    const banner = document.getElementById("hero-banner");
    syncFloatingControlMenu(page);
    
    // 네비게이션 액티브 상태 초기화 (nav-home 메뉴가 HTML에서 삭제되었을 때 null 에러로 터지는 것을 방지하는 안전장치입니다)
    const homeNav = document.getElementById("nav-home");
    if (homeNav) homeNav.classList.remove("active");
    
    const adminNav = document.getElementById("nav-admin");
    if (adminNav) adminNav.classList.remove("active");
    const mypageNav = document.getElementById("nav-mypage");
    if (mypageNav) mypageNav.classList.remove("active");
    
    const noticeNav = document.getElementById("nav-notice");
    if (noticeNav) noticeNav.classList.remove("active");
    const reviewNav = document.getElementById("nav-review");
    if (reviewNav) reviewNav.classList.remove("active");
    const eventNav = document.getElementById("nav-event");
    if (eventNav) eventNav.classList.remove("active");
    
    // 뷰들 전체 가리기 (신설 3대 뷰 포함)
    document.getElementById("view-home").style.display = "none";
    document.getElementById("view-detail").style.display = "none";
    document.getElementById("view-checkout").style.display = "none";
    document.getElementById("view-mypage").style.display = "none";
    document.getElementById("view-admin").style.display = "none";
    document.getElementById("view-wishlist").style.display = "none";
    document.getElementById("view-notice").style.display = "none";
    document.getElementById("view-review").style.display = "none";
    
    // [신설] 상단 스티키 필터 바 노출 제어 (대표님 요청으로 홈 화면뿐만 아니라 상품 상세페이지에서도 카테고리가 보이도록 수정)
    const filterBar = document.getElementById("main-shop-filter-bar");
    if (filterBar) {
        if (page === 'home' || page === 'detail') {
            filterBar.style.display = "flex";
        } else {
            filterBar.style.display = "none";
        }
    }
    
    if (page === 'home') {
        // 👑 [신설] 로고 클릭 및 홈 복귀 시 걸려있던 카테고리/브랜드/검색 필터와 UI를 깨끗이 초기화
        resetAllFilters();
        
        // nav-home(COLLECTION) 메뉴가 HTML에 존재할 때만 active 클래스를 입혀 하이라이트하도록 널 가드를 삽입했습니다.
        const homeNav = document.getElementById("nav-home");
        if (homeNav) homeNav.classList.add("active");
        
        if (banner) banner.style.display = "flex";
        document.getElementById("view-home").style.display = "block";
        fetchProducts();
        fetchQnaPosts();
    } 
    else if (page === 'detail') {
        if (banner) banner.style.display = "none";
        document.getElementById("view-detail").style.display = "block";
    }
    else if (page === 'checkout') {
        if (banner) banner.style.display = "none";
        document.getElementById("view-checkout").style.display = "block";
    }
    else if (page === 'mypage') {
        if (!currentUser) {
            alert("🔒 마이페이지는 회원 전용입니다! 먼저 간편 로그인을 진행해 주세요.");
            openAuthModal('signin');
            return;
        }
        if (mypageNav) mypageNav.classList.add("active");
        if (banner) banner.style.display = "none";
        
        document.getElementById("my-name").value = userProfile?.name || "";
        document.getElementById("my-phone").value = userProfile?.phone || "";
        document.getElementById("my-postcode").value = userProfile?.postcode || "";
        document.getElementById("my-address").value = userProfile?.address || "";
        document.getElementById("my-address-detail").value = userProfile?.address_detail || "";
        
        const balanceSpan = document.getElementById("mypage-point-balance");
        if (balanceSpan) {
            const points = userProfile?.points !== undefined ? userProfile.points : 3000;
            balanceSpan.textContent = points.toLocaleString();
        }
        
        document.getElementById("view-mypage").style.display = "block";
        fetchUserOrders();
        renderMyPageWishlist();
    }
    else if (page === 'admin') {
        const adminNav = document.getElementById("nav-admin");
        if (adminNav) adminNav.classList.add("active");
        if (banner) banner.style.display = "none";
        document.getElementById("view-admin").style.display = "block";
        
        const sessionToken = sessionStorage.getItem("admin_authenticated");
        const isAuth = (sessionToken === ADMIN_PASSWORD_HASH);
        if (isAuth) {
            showAdminDashboard();
        } else {
            showAdminLoginGate();
        }
    }
    else if (page === 'wishlist') {
        if (banner) banner.style.display = "none";
        document.getElementById("view-wishlist").style.display = "block";
        renderWishlistPage();
    }
    else if (page === 'notice') {
        if (banner) banner.style.display = "none";
        if (noticeNav) noticeNav.classList.add("active");
        document.getElementById("view-notice").style.display = "block";
        renderNoticePage();
    }
    else if (page === 'review') {
        if (banner) banner.style.display = "none";
        if (reviewNav) reviewNav.classList.add("active");
        document.getElementById("view-review").style.display = "block";
        renderReviewFeedPage();
    }
    
    syncFloatingControlMenu(page);
    window.scrollTo(0, 0);
}

// 📦 상품 컬렉션 목록 DB 수집 (2.5초 타임아웃 보호막 장착!)
async function fetchProducts() {
    const grid = document.getElementById("product-grid");
    // 초기 로더 렌더링 유지
    if (grid && allProducts.length === 0) {
        grid.innerHTML = `
            <div class="loading-box">
                <div class="spinner"></div>
                <p>PKB71 프리미엄 상품을 실시간 가져오고 있습니다...</p>
            </div>
        `;
    }

    if (supabaseClient) {
        try {
            // ⏱️ Supabase DB에서 꺼내오는 것을 2.5초간 대기, 초과 시 즉시 catch문으로 리커버리!
            // 🌳 [진열 순위 동기화] display_order 오름차순(1, 2, 3...)을 1순위 정렬 기준으로 추가
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .select("*")
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            allProducts = data || [];
            if (allProducts.length === 0) {
                allProducts = [...DUMMY_PRODUCTS];
            }
        } catch (e) {
            // ⏱️ 타임아웃 오류 발생 시 로컬 바탕화면에 내장된 명품 더미 데이터로 즉시 전환 구동!
            console.warn("⏱️ [보안 지연 우회] 2.5초 지연으로 지능형 명품 더미 데이터 즉시 구동:", e.message);
            allProducts = [...DUMMY_PRODUCTS];
        }
    } else {
        allProducts = [...DUMMY_PRODUCTS];
    }

    // 👑 [신설] 긁어온 상품 정보를 기반으로 브랜드를 고유 수집하여 필터 상자에 주입합니다.
    if (typeof renderBrandOptions === "function") {
        renderBrandOptions();
    } else {
        console.warn("⚠️ [로딩 대기] renderBrandOptions 함수가 아직 로드되지 않았습니다.");
    }

    if (typeof executeFilterAndSort === "function") {
        executeFilterAndSort();
    } else {
        console.warn("⚠️ [로딩 대기] executeFilterAndSort 함수가 아직 로드되지 않았습니다.");
    }
}

function openDeliveryModal() {
    const modal = document.getElementById("delivery-modal");
    if (modal) {
        document.getElementById("delivery-track-number").value = "";
        modal.style.display = "flex";
    }
}

function closeDeliveryModal() {
    const modal = document.getElementById("delivery-modal");
    if (modal) modal.style.display = "none";
}

function closeDeliveryModalOutside(event) {
    if (event.target.id === "delivery-modal") {
        closeDeliveryModal();
    }
}

function trackDeliveryDirect() {
    const carrier = document.getElementById("delivery-carrier").value;
    const trackNum = document.getElementById("delivery-track-number").value.trim().replace(/[^0-9]/g, "");
    
    if (!trackNum) {
        alert("⚠️ 조회하실 운송장 번호(숫자만)를 친절하게 입력해 주세요!");
        return;
    }
    
    let url = "";
    
    // 국내 주요 택배사별 기지국 트래킹 경로 공식 세팅
    switch (carrier) {
        case "kr.epost": // 우체국택배
            url = `https://service.epost.go.kr/trace.RetrieveDomTreptnGrpList.postal?sid1=${trackNum}`;
            break;
        case "kr.cjlogistics": // CJ대한통운
            url = `https://www.doortodoor.co.kr/parcel/doortodoor.do?fsp_action=Parcel_cmd&fsp_cmd=retrieve_domestic_parcel_select&invc_no=${trackNum}`;
            break;
        case "kr.hanjin": // 한진택배
            url = `https://www.hanjin.co.kr/ko/delivery/delivery/tracking?wblnum=${trackNum}`;
            break;
        case "kr.lotte": // 롯데택배
            url = `https://www.lotteglogis.com/home/personal/inquiry/track?InvNo=${trackNum}`;
            break;
        case "kr.logen": // 로젠택배
            url = `https://www.ilogen.com/web/personal/trace/${trackNum}`;
            break;
        case "kr.cvsnet": // 편의점택배
            url = `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${trackNum}`;
            break;
        default:
            url = `https://tracker.delivery/#/${carrier}/${trackNum}`;
    }
    
    window.open(url, "_blank");
    closeDeliveryModal();
}

// 5. [대표님 전용 공지사항 및 이벤트 어드민 관리 엔진]
function scrollToQnaSection() {
    navigateTo('home');
    
    setTimeout(() => {
        const qnaSection = document.querySelector(".qna-section");
        if (qnaSection) {
            qnaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
}

// 헤더 EVENT 클릭 시 ➡️ 공지 게시판으로 이동하여 이벤트 탭 즉시 활성화
function navigateToNoticeTab(tab) {
    navigateTo('notice');
    setTimeout(() => {
        filterNoticeBoard(tab);
    }, 100);
}

// 헤더 우측 럭셔리 실시간 통합 검색 엔진
function handleHeaderSearchKeyUp(event) {
    if (event.key === "Enter") {
        executeHeaderSearch();
    }
}

function executeHeaderSearch() {
    const input = document.getElementById("header-search-input");
    if (!input) return;
    const query = input.value.trim();
    
    // 메인 홈 화면으로 안전하게 라우팅
    navigateTo('home');
    
    // 👑 [보안/Fail-safe] 필터바 내의 검색창 삭제에 따른 변수 다이렉트 할당 및 검색 실행
    searchQuery = query;
    currentPage = 1; // 검색 수행 시 첫 페이지로 강제 복귀
    
    const mainSearchInput = document.getElementById("search-input");
    if (mainSearchInput) {
        mainSearchInput.value = query;
    }
    
    executeFilterAndSort(); // 실시간 필터 엔진 가동
}

// 📂 [3안 적용] 주문 전 가이드라인 슬림 아코디언 토글 엔진 (높이 값 애니메이션 연산 탑재)
function toggleGuidelinesAccordion() {
    const accordion = document.querySelector(".luxury-guidelines-accordion");
    const content = document.getElementById("guidelines-accordion-content");
    const icon = document.getElementById("guidelines-accordion-icon");
    
    if (!accordion || !content) return;
    
    const isActive = accordion.classList.toggle("active");
    
    if (isActive) {
        // 자연스럽게 촤르륵 열리는 애니메이션 기법 (scrollHeight 자동 연산)
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.padding = "20px 40px";
        if (icon) icon.textContent = "▲";
    } else {
        // 부드럽게 접히는 애니메이션
        content.style.maxHeight = "0";
        content.style.padding = "0 40px";
        if (icon) icon.textContent = "▼";
    }
}

// 📄 [신설] 상품 상세 설명 슬림 아코디언 토글 엔진 (실시간 높이 계산 슬라이딩 탑재)
function toggleDescriptionAccordion() {
    const accordion = document.querySelector(".luxury-description-accordion");
    const content = document.getElementById("description-accordion-content");
    const icon = document.getElementById("description-accordion-icon");
    
    if (!accordion || !content) return;
    
    const isActive = accordion.classList.toggle("active");
    
    if (isActive) {
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.padding = "20px 40px";
        if (icon) icon.textContent = "▲";
    } else {
        content.style.maxHeight = "0";
        content.style.padding = "0 40px";
        if (icon) icon.textContent = "▼";
    }
}

// =========================================================================
// 💬 [신설] 우측 하단 플로팅 퀵 메뉴 - 위아래 이동 스크롤러 동작 엔진
// =========================================================================

/**
 * 페이지의 최상단(Top)으로 부드럽게 화면을 올려주는 함수
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: "smooth" // 부드러운 스크롤 애니메이션
    });
}

/**
 * 페이지의 최하단(Bottom)으로 부드럽게 화면을 내려주는 함수
 */
function scrollToBottom() {
    window.scrollTo({
        top: document.body.scrollHeight, // 전체 문서의 세로 높이값으로 타겟 지정
        behavior: "smooth" // 부드러운 스크롤 애니메이션
    });
}

// =========================================================================
// ⏱️ [신설] 메인 히어로 2페이지 페이드 캐러셀 타이머 엔진
// =========================================================================
let currentHeroIndex = 0;
let heroCarouselTimer = null;

/**
 * 특정 인덱스의 히어로 슬라이드를 노출하고 이전 활성 슬라이드를 가려줍니다.
 * @param {number} index - 보여주고자 하는 슬라이드의 대상 인덱스 번호 (0 또는 1)
 */
function showHeroSlide(index) {
    const slides = document.querySelectorAll(".hero-slide");
    const dots = document.querySelectorAll(".hero-dot");
    if (slides.length === 0) return;
    
    // 인덱스 롤링 보정 (범위를 넘어가면 처음이나 마지막으로 순환)
    if (index >= slides.length) {
        currentHeroIndex = 0;
    } else if (index < 0) {
        currentHeroIndex = slides.length - 1;
    } else {
        currentHeroIndex = index;
    }
    
    // 모든 슬라이드와 점(도트)의 active 클래스 제거
    slides.forEach(slide => slide.classList.remove("active"));
    dots.forEach(dot => dot.classList.remove("active"));
    
    // 지정된 타겟 슬라이드와 점(도트) 활성화
    slides[currentHeroIndex].classList.add("active");
    if (dots[currentHeroIndex]) dots[currentHeroIndex].classList.add("active");
}

/**
 * 좌우 수동 화살표 클릭에 의해 배너를 이동시킵니다.
 * @param {number} step - 이동할 상대값 (이전: -1, 다음: 1)
 */
function moveHeroSlide(step) {
    resetHeroTimer(); // 수동 조작 시 자동 타이머의 대기 시간을 리셋
    showHeroSlide(currentHeroIndex + step);
}

/**
 * 하단 도트 점 클릭에 의해 특정 슬라이드로 바로 건너뜁니다.
 * @param {number} index - 바로 노출할 슬라이드 절대 인덱스
 */
function currentHeroSlide(index) {
    resetHeroTimer(); // 수동 조작 시 자동 타이머의 대기 시간을 리셋
    showHeroSlide(index);
}

/**
 * 5초 간격으로 배너가 우아하게 바뀌도록 타이머를 구동합니다.
 */
function startHeroTimer() {
    if (heroCarouselTimer) clearInterval(heroCarouselTimer);
    heroCarouselTimer = setInterval(() => {
        showHeroSlide(currentHeroIndex + 1);
    }, 5000); // 5000ms = 5초 간격 전환
}

/**
 * 수동 조작 직후 자동 롤링 타이머를 해제했다가 5초 타이머를 재시작합니다.
 */
function resetHeroTimer() {
    clearInterval(heroCarouselTimer);
    startHeroTimer();
}

/**
 * 🆕 [신설] 신상품 가로 스크롤 슬라이더 좌우 롤링 도우미 스크립트 함수
 * @param {string} direction - 이동할 가로 방향 ('prev' 또는 'next')
 */
function slideProducts(direction) {
    const slider = document.getElementById("new-arrivals-slider");
    if (!slider) return;
    const scrollAmount = 300; // 한 번 클릭 시 부드럽게 회전 이동할 가로 픽셀량 (300px)
    if (direction === 'prev') {
        slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
        slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
}

// =========================================================================
// 🎁 [신설] UX 개선: 브라우저 기본 alert()을 세련된 미니멀 토스트 알림으로 가로채기(Hijack)
// =========================================================================

// 브라우저의 기본 alert 창을 가로채어 커스텀 토스트 알림창이 대신 열리도록 설정합니다.
// 이렇게 하면 기존의 모든 alert("문구") 코드들을 단 한 줄도 손대지 않고 자동으로 세련되게 바꿀 수 있습니다.
window.alert = function(message) {
    showToast(message);
};

/**
 * 화면 하단 중앙에 모던하게 스무스한 페이드인 애니메이션으로 토스트 알림을 노출하는 함수
 * @param {string} message - 대표님 쇼핑몰 고객 또는 어드민에게 보여줄 실시간 안내 텍스트
 */
function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return; // 만약 index.html에 토스트 컨테이너가 없다면 즉시 무시

    // 1. 새로운 토스트 메시지 껍데기(div) 동적 생성
    const toast = document.createElement("div");
    toast.className = "luxury-toast";
    
    // 2. 메시지 안의 줄바꿈 문자(\n)를 웹 화면에 맞게 HTML 줄바꿈(<br>)으로 자동 치환
    toast.innerHTML = message.replace(/\n/g, "<br>");

    // 3. 화면 하단 토스트 리스트 전용 대기소(container)에 적재
    container.appendChild(toast);

    // 4. 즉시 스타일을 주면 페이드가 먹히지 않으므로, 0.1초의 미세한 간격을 준 뒤 active(show) 클래스 주입
    setTimeout(() => {
        toast.classList.add("show");
    }, 100);

    // 5. 3.5초(3500ms) 동안 고객이 넉넉히 읽을 수 있게 노출한 후 서서히 사라지는 타이머 가동
    setTimeout(() => {
        toast.classList.remove("show"); // 페이드아웃 효과 시작
        
        // 6. CSS 페이드아웃 트랜지션 시간(0.4초)이 끝난 후 HTML 구조(DOM)에서 흔적 없이 완전히 청소
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 400);
    }, 3500);
}

/**
 * 📞 [추가 고도화] 입력란에 전화번호를 입력할 때 숫자를 제외한 문자를 필터링하고
 * 자동으로 하이픈(-)을 010-XXXX-XXXX 형식으로 추가하여 포맷해 주는 헬퍼 함수
 * @param {HTMLInputElement} input - 이벤트가 발생한 전화번호 입력창 엘리먼트
 */
function formatPhoneNumber(input) {
    // 1. 숫자 이외의 문자 필터링
    let value = input.value.replace(/[^0-9]/g, "");
    let formatted = "";

    // 2. 길이에 따라 하이픈 자동 삽입
    if (value.length < 4) {
        formatted = value;
    } else if (value.length < 7) {
        formatted = value.substring(0, 3) + "-" + value.substring(3);
    } else if (value.length < 11) {
        formatted = value.substring(0, 3) + "-" + value.substring(3, 3) + "-" + value.substring(6);
    } else {
        // 최대 11자리 기준 포맷팅 (010-1234-5678)
        formatted = value.substring(0, 3) + "-" + value.substring(3, 4) + "-" + value.substring(7, 4);
    }

    // 3. 포맷팅된 텍스트로 값 덮어쓰기
    input.value = formatted.slice(0, 13); // 최대 13자리 제한 (하이픈 2개 포함)
}

/**
 * 👑 [신설 4단계] 로고 클릭 시 모든 필터 및 드롭다운/검색 상태값을 최초 청정 상태로 되돌리는 리셋 엔진
 */
function resetAllFilters() {
    // 1. 자바스크립트 전역 필터 제어 상태값 초기화
    selectedBrand = "";
    searchQuery = "";
    currentCategory = "All";
    
    // 🏷️ [계층형 카테고리 고도화] 대/중/소 계층형 카테고리 필터 상태 변수 리셋
    currentCategoryLarge = "All";
    currentCategoryMedium = "";
    currentCategorySmall = "";
    
    currentSort = "latest";
    currentPage = 1;
    
    // 2. 상단 필터바 UI 초기화 및 동기화
    const brandSelect = document.getElementById("brand-select");
    if (brandSelect) brandSelect.value = ""; // 브랜드 ALL(전체)로 선택 리셋
    
    const sortSelect = document.getElementById("sort-select");
    if (sortSelect) sortSelect.value = "latest"; // 정렬 최신순으로 리셋
    
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.value = ""; // 메인 검색창 비움
    
    const headerSearchInput = document.getElementById("header-search-input");
    if (headerSearchInput) headerSearchInput.value = ""; // 네비 검색창 비움
    
    // 3. 카테고리 활성화 탭 하이라이트를 'All'로 복귀 강제 동기화
    renderShopCategoryTabs(); // 카테고리 메뉴 목록 리인출로 All 하이라이트 주입
}

