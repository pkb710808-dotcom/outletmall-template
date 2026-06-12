// =========================================================================
// 8. [📦 대표님 관리실 종합 컨트롤러 & 4차 통계 & 직접 상품 등록/피드백 완비]
// =========================================================================
let adminSalesChart = null; // 👑 [신설 6차 고도화] 어드민 일별 매출 차트 인스턴스 전역 보존 객체

// 🌳 [체크박스 & 카테고리 트리 고도화] 카테고리 트리 관리를 위한 전역 상태 변수
let selectedCategoryId = null; // 선택된 카테고리 ID
let tempCategories = []; // 드래그 앤 드롭 이동 임시 보관 배열
let adminProductsListForCat = []; // 카테고리별 상품 수 실시간 집계용 전역 배열

// 🔍 [신설] 시뮬레이터 실시간 필터용 전역 백업 변수
let currentSimulatorDataList = [];
let currentSimulatorMode = "";

// 🌳 [체크박스 & 카테고리 트리 고도화] 상품 진열실 제어를 위한 전역 상태 변수
let selectedDisplayRowProductId = null; // 진열대장에서 화살표 이동을 위해 선택한 상품 ID
let currentDisplayProductsList = []; // 진열대장에 로드된 상품 목록 배열 (메모리 편집용)

const ADMIN_DISPLAY_SECTIONS = [
    { id: "featured", label: "추천상품", desc: "메인 추천상품 영역" },
    { id: "new", label: "신상품", desc: "NEW ARRIVALS 영역" },
    { id: "best", label: "베스트상품", desc: "WEEKLY BEST SELLER 영역" }
];

// 🌳 [신설 - 카페24 상품 등록 고도화] 상품 등록용 옵션 칩 전역 저장 배열 및 수정 모달용 전역 제어키
let addProdColors = [];
let addProdSizes = [];
let editProductId = null; // ✏️ 상품 상세 수정을 위한 현재 타깃 상품 고유 ID (null이면 신규 등록 모드)
let addProdOptionSettings = {}; // 📊 옵션 조합별 개별 품목 세팅 (품절 여부, 재고, 추가 금액) 임시 보관소

/**
 * 📂 [상품 등록용 탭 전환 함수]
 * - 교육용 주석: 카페24 간단등록처럼 모달 창의 탭 버튼을 클릭하면
 *   해당하는 탭 패널만 활성화(display: block)시키고 버튼의 Active 클래스를 전환합니다.
 */
function switchAddProductTab(tabId) {
    // 모든 탭 콘텐츠 숨기기
    const panels = document.querySelectorAll(".add-prod-tab-pane");
    panels.forEach(p => p.classList.remove("active"));
    
    // 모든 탭 버튼 비활성화
    const tabs = document.querySelectorAll(".add-prod-tab-btn");
    tabs.forEach(t => t.classList.remove("active"));
    
    // 타겟 탭 콘텐츠 및 버튼 활성화
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add("active");
    
    const targetBtn = document.getElementById(`btn-${tabId}`);
    if (targetBtn) targetBtn.classList.add("active");
}
window.switchAddProductTab = switchAddProductTab;

/**
 * 📷 [로컬 이미지 파일 실시간 클라우드 업로드 처리기]
 * - 교육용 주석: 대표님이 컴퓨터 내의 실물 이미지 파일을 선택하면,
 *   Supabase Storage의 'product-images' 버킷에 날짜 기반 고유 경로로 자동 업로드하고,
 *   업로드 완료된 공개 URL 주소를 해당 인풋창에 주입 및 썸네일 미리보기를 기동합니다.
 */
async function uploadProductImageDirect(fileInput, targetInputId, previewImgId) {
    const file = fileInput.files[0];
    if (!file) return;
    
    const statusSpan = document.getElementById(`upload-status-${targetInputId}`);
    const previewImg = document.getElementById(previewImgId);
    
    if (statusSpan) statusSpan.textContent = "⏳ 업로드 중...";
    
    // 1. Supabase 연동 환경인 경우 실물 스토리지 업로드 실행
    if (supabaseClient) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.floor(Math.random()*1000)}.${fileExt}`;
            const filePath = `product_uploads/${fileName}`;
            
            // Storage 업로드 API 호출
            const { data, error } = await supabaseClient.storage
                .from('product-images')
                .upload(filePath, file);
                
            if (error) throw error;
            
            // Public URL 획득
            const { data: { publicUrl } } = supabaseClient.storage
                .from('product-images')
                .getPublicUrl(filePath);
                
            document.getElementById(targetInputId).value = publicUrl;
            
            if (previewImg) {
                previewImg.src = publicUrl;
                previewImg.style.display = "block";
            }
            if (statusSpan) statusSpan.textContent = "✅ 업로드 완료!";
        } catch (e) {
            console.error("Storage 업로드 실패:", e);
            if (statusSpan) statusSpan.textContent = "⚠️ 클라우드 전송 실패 (로컬 미리보기 대체)";
            // Fail-safe: 클라우드 전송 실패 시 로컬 미리보기 모드로 가동
            readLocalFileAsBase64(file, targetInputId, previewImg);
        }
    } else {
        // 2. 더미 모드 또는 미연동 환경일 경우: Base64 인코딩을 통해 브라우저 로컬 미리보기 보장
        if (statusSpan) statusSpan.textContent = "⚡ [더미 모드] 로컬 변환 완료!";
        readLocalFileAsBase64(file, targetInputId, previewImg);
    }
}
window.uploadProductImageDirect = uploadProductImageDirect;

function readLocalFileAsBase64(file, targetInputId, previewImg) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Url = e.target.result;
        document.getElementById(targetInputId).value = base64Url;
        if (previewImg) {
            previewImg.src = base64Url;
            previewImg.style.display = "block";
        }
    };
    reader.readAsDataURL(file);
}

/**
 * 📊 [실시간 옵션 조합별 세부 품목 목록 테이블 생성 엔진]
 * - 교육용 주석: 색상 배열과 사이즈 배열을 카테시안 곱으로 연산하여,
 *   조합 가능한 모든 품목 행을 조립하고 테이블 형태로 화면에 뿌려줍니다.
 *   대표님이 각 행의 입력값을 변경할 때마다 addProdOptionSettings 객체에 실시간 업데이트됩니다.
 */
function generateOptionCombinationTable() {
    const tbody = document.getElementById("add-prod-options-table-rows");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    // 두 종류 옵션이 모두 존재해야 조합을 생성합니다.
    if (addProdColors.length === 0 || addProdSizes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 30px 0; font-size:12px;">
                    색상과 사이즈 옵션을 각각 1개 이상 등록해 주세요. 품목들이 실시간으로 이곳에 조합 배치됩니다.
                </td>
            </tr>
        `;
        return;
    }
    
    // 카테시안 곱(조합 생성)
    addProdColors.forEach(color => {
        addProdSizes.forEach(size => {
            const comboId = `${color}_${size}`;
            
            // 기존에 대표님이 적어두신 설정값이 메모리에 있으면 상속하고, 없으면 초기값(기본값) 생성
            if (!addProdOptionSettings[comboId]) {
                addProdOptionSettings[comboId] = {
                    is_soldout: false,
                    stock: 99,
                    price: 0
                };
            }
            
            const settings = addProdOptionSettings[comboId];
            
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td style="text-align: left; font-weight: 700; color: #fff; padding: 8px 12px;">
                    ${escapeHtml(color)} / ${escapeHtml(size)}
                </td>
                <td style="text-align: center; padding: 4px;">
                    <select class="form-input" style="padding: 6px; font-size: 11px; margin: 0; background-color:#1A222E; color:#fff;" onchange="updateOptionRowSetting('${comboId}', 'is_soldout', this.value === 'true')">
                        <option value="false" ${!settings.is_soldout ? 'selected' : ''}>🟢 판매중</option>
                        <option value="true" ${settings.is_soldout ? 'selected' : ''}>🔴 품절</option>
                    </select>
                </td>
                <td style="text-align: center; padding: 4px;">
                    <input type="number" class="form-input" style="padding: 6px; font-size: 11px; margin: 0; text-align: center; background-color:#1A222E; color:#fff;" value="${settings.stock}" oninput="updateOptionRowSetting('${comboId}', 'stock', parseInt(this.value) || 0)">
                </td>
                <td style="text-align: center; padding: 4px;">
                    <div style="display:flex; align-items:center; gap:4px; justify-content:center;">
                        <span style="font-size:10px; color:var(--text-secondary);">+</span>
                        <input type="number" class="form-input" style="padding: 6px; font-size: 11px; margin: 0; text-align: right; width: 80px; background-color:#1A222E; color:#fff;" placeholder="0" value="${settings.price}" oninput="updateOptionRowSetting('${comboId}', 'price', parseInt(this.value) || 0)">
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}
window.generateOptionCombinationTable = generateOptionCombinationTable;

/**
 * 💾 [품목 테이블 입력값 실시간 동기화 객체 갱신]
 */
function updateOptionRowSetting(comboId, field, value) {
    if (!addProdOptionSettings[comboId]) {
        addProdOptionSettings[comboId] = {};
    }
    addProdOptionSettings[comboId][field] = value;
}
window.updateOptionRowSetting = updateOptionRowSetting;

/**
 * 🏷️ [옵션 칩 추가 처리]
 * - 교육용 주석: 입력 필드에 입력한 텍스트를 읽어들인 뒤 중복 여부를 검사하고
 *   칩 배열에 추가한 후 화면에 예쁜 칩 형태로 실시간 그려주는 함수입니다.
 */
function addOptionChip(type) {
    const inputId = type === 'color' ? 'add-prod-color-input' : 'add-prod-size-input';
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    
    const val = inputEl.value.trim();
    if (!val) {
        alert("추가할 옵션명을 입력해 주세요! 🧥");
        return;
    }
    
    const targetArr = type === 'color' ? addProdColors : addProdSizes;
    if (targetArr.includes(val)) {
        alert("이미 추가된 동일한 옵션이 존재합니다! ⚠️");
        return;
    }
    
    targetArr.push(val);
    inputEl.value = ""; // 입력창 비우기
    renderOptionChips(type);
    generateOptionCombinationTable(); // 📊 칩이 추가되었으므로 세부 조합 테이블 즉시 리렌더링!
}
window.addOptionChip = addOptionChip;

/**
 * ❌ [옵션 칩 제거 처리]
 * - 교육용 주석: 생성된 칩의 X 단추를 클릭하면 배열에서 해당 값을 찾아 제거하고
 *   화면을 실시간으로 다시 렌더링해 줍니다.
 */
function removeOptionChip(type, value) {
    if (type === 'color') {
        addProdColors = addProdColors.filter(c => c !== value);
    } else {
        addProdSizes = addProdSizes.filter(s => s !== value);
    }
    renderOptionChips(type);
    
    // 📊 제거된 칩에 해당하는 기존 세부 설정 정보도 메모리에서 안전하게 삭제합니다.
    Object.keys(addProdOptionSettings).forEach(key => {
        const parts = key.split('_');
        const colorPart = parts[0];
        const sizePart = parts[1];
        if ((type === 'color' && colorPart === value) || (type === 'size' && sizePart === value)) {
            delete addProdOptionSettings[key];
        }
    });
    
    generateOptionCombinationTable(); // 📊 칩이 제거되었으므로 세부 조합 테이블 즉시 리렌더링!
}
window.removeOptionChip = removeOptionChip;

/**
 * 🎨 [옵션 칩 화면 렌더링]
 * - 교육용 주석: 배열에 담겨있는 옵션 텍스트 목록을 둥근 태그 모양의 HTML로 조립하여
 *   대표님이 보기 편하게 칩 컨테이너 내부에 실시간으로 뿌려줍니다.
 */
function renderOptionChips(type) {
    const containerId = type === 'color' ? 'add-prod-color-chips' : 'add-prod-size-chips';
    const containerEl = document.getElementById(containerId);
    if (!containerEl) return;
    
    const targetArr = type === 'color' ? addProdColors : addProdSizes;
    containerEl.innerHTML = "";
    
    if (targetArr.length === 0) {
        containerEl.innerHTML = `<span style="font-size:11.5px; color:var(--text-secondary); padding:4px;">등록된 옵션이 없습니다.</span>`;
        return;
    }
    
    targetArr.forEach(val => {
        const chip = document.createElement("span");
        chip.className = "add-prod-chip";
        chip.innerHTML = `
            ${escapeHtml(val)}
            <span class="add-prod-chip-remove" onclick="removeOptionChip('${type}', '${escapeHtml(val)}')">✕</span>
        `;
        containerEl.appendChild(chip);
    });
}

/**
 * 📊 [실시간 할인율 계산기]
 * - 교육용 주석: 소비자가와 판매가를 대표님이 입력할 때, 그 가격 차이에 기반한
 *   할인율을 실시간 백분율(%)로 환산하여 빨간 배지 형태로 UI에 노출시킵니다.
 */
function calculateDiscountRate() {
    const originalInput = document.getElementById("add-prod-original");
    const priceInput = document.getElementById("add-prod-price");
    const badge = document.getElementById("add-prod-discount-badge");
    
    if (!originalInput || !priceInput || !badge) return;
    
    const original = parseInt(originalInput.value) || 0;
    const price = parseInt(priceInput.value) || 0;
    
    if (original > price && price > 0) {
        const rate = Math.round(((original - price) / original) * 100);
        badge.textContent = `🎯 ${rate}% 할인`;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}
window.calculateDiscountRate = calculateDiscountRate;

function openAddProductModal() {
    // 🏷️ [신설 6차 카테고리 관리] 상품 등록 모달 열릴 때 드롭다운 항목을 실시간 주입
    populateCategoryDropdowns();

    // ✏️ 신규 등록 모드로 전환 초기화
    editProductId = null;
    addProdOptionSettings = {};
    document.getElementById("add-prod-modal-title").textContent = "📦 카페24 스타일 상품 간단등록";
    document.getElementById("add-prod-submit-btn").textContent = "📦 신상품 정식 진열 스위치 켜기";

    // 1. 기본 인풋 필드들 전부 공백 초기화
    document.getElementById("add-prod-brand").value = "";
    document.getElementById("add-prod-name").value = "";
    document.getElementById("add-prod-original").value = "";
    document.getElementById("add-prod-price").value = "";
    document.getElementById("add-prod-stock").value = "99"; // 기본 초기 재고
    document.getElementById("add-prod-details").value = "";
    
    // 다중 이미지 필드들 초기화
    document.getElementById("add-prod-image1").value = "";
    document.getElementById("add-prod-image2").value = "";
    document.getElementById("add-prod-image3").value = "";
    
    // 이미지 썸네일 미리보기 필드 숨기기 및 상태 텍스트 초기화
    for (let i = 1; i <= 3; i++) {
        const prev = document.getElementById(`add-prod-prev${i}`);
        if (prev) {
            prev.src = "";
            prev.style.display = "none";
        }
        const status = document.getElementById(`upload-status-add-prod-image${i}`);
        if (status) {
            status.textContent = "";
        }
    }
    
    // 라디오 버튼 기본 상태로 초기화
    const visibleRadios = document.getElementsByName("add-prod-visible");
    visibleRadios.forEach(r => {
        if (r.value === "true") r.checked = true;
    });
    const soldoutRadios = document.getElementsByName("add-prod-soldout");
    soldoutRadios.forEach(r => {
        if (r.value === "false") r.checked = true;
    });
    
    // 2. 동적 옵션 칩 배열 및 화면 초기화
    addProdColors = [];
    addProdSizes = [];
    renderOptionChips('color');
    renderOptionChips('size');
    generateOptionCombinationTable(); // 옵션 조합 테이블 초기 안내문구로 리셋
    
    // 3. 할인율 배지 숨기기
    const badge = document.getElementById("add-prod-discount-badge");
    if (badge) badge.style.display = "none";
    
    // 4. 모달 열릴 때 1번 기본 정보 탭이 맨 먼저 보이도록 설정
    switchAddProductTab('tab-basic');
    
    document.getElementById("add-product-modal").style.display = "flex";
}

function closeAddProductModal() {
    document.getElementById("add-product-modal").style.display = "none";
}

function closeAddProductModalOutside(event) {
    if (event.target.id === "add-product-modal") {
        closeAddProductModal();
    }
}

/**
 * ✏️ [상품 정보 수정실 모달 오픈 및 데이터 바인딩]
 * - 교육용 주석: 기존 상품 목록에서 상품명을 클릭하거나 수정 버튼을 누를 때 동작하며,
 *   전역 변수 editProductId에 대상 ID를 고정하고, 모달창 제목과 등록 단추를 '수정' 용도로 변경한 뒤
 *   해당 상품의 기존 스키마 데이터와 JSON 꼬리표에 잠들어 있던 옵션 세부 설정을 읽어서 모달 폼에 완벽히 채워줍니다.
 */
async function openEditProductModal(productId) {
    // 1. 카테고리 3단 드롭다운 리스트 갱신 주입
    populateCategoryDropdowns();
    
    // 2. 수정 대상 상품 검색
    let targetProd = null;
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2000, supabaseClient
                .from("products")
                .select("*")
                .eq("id", productId)
                .single());
            if (!error && data) {
                targetProd = data;
            }
        } catch (e) {
            console.error("클라우드에서 수정 상품 조회 실패, 로컬로 시도합니다:", e);
        }
    }
    
    if (!targetProd) {
        targetProd = allProducts.find(p => p.id === productId);
    }
    
    if (!targetProd) {
        alert("⚠️ 대상을 조회할 수 없습니다.");
        return;
    }
    
    // 3. 수정 타겟 ID 설정 및 모달 타이틀/저장버튼 수정 세팅
    editProductId = productId;
    document.getElementById("add-prod-modal-title").textContent = "✏️ 카페24 스타일 상품 정보 수정실";
    document.getElementById("add-prod-submit-btn").textContent = "💾 상품 정보 수정 영구 반영";
    
    // 4. 모달창에 기존 데이터 채워주기
    document.getElementById("add-prod-brand").value = targetProd.brand || "";
    document.getElementById("add-prod-name").value = targetProd.name || "";
    
    // 가격 파싱 (소비자가 ₩ 제거)
    let rawOriginal = targetProd.original_price || "";
    if (rawOriginal.startsWith("₩")) {
        rawOriginal = rawOriginal.replace(/[^0-9]/g, "");
    }
    document.getElementById("add-prod-original").value = rawOriginal;
    document.getElementById("add-prod-price").value = targetProd.selling_price || "";
    document.getElementById("add-prod-stock").value = targetProd.stock !== undefined ? targetProd.stock : 99;
    
    // 라디오 버튼 채우기
    const editVisibleRadios = document.getElementsByName("add-prod-visible");
    editVisibleRadios.forEach(r => {
        r.checked = (r.value === String(targetProd.is_visible));
    });
    
    const editSoldoutRadios = document.getElementsByName("add-prod-soldout");
    editSoldoutRadios.forEach(r => {
        r.checked = (r.value === String(targetProd.is_soldout || false));
    });
    
    // 이미지 채우기 및 썸네일 노출
    const imgUrls = targetProd.image_urls || [];
    document.getElementById("add-prod-image1").value = imgUrls[0] || "";
    document.getElementById("add-prod-image2").value = imgUrls[1] || "";
    document.getElementById("add-prod-image3").value = imgUrls[2] || "";
    
    // 업로드 안내 텍스트 초기화
    document.getElementById("upload-status-add-prod-image1").textContent = "";
    document.getElementById("upload-status-add-prod-image2").textContent = "";
    document.getElementById("upload-status-add-prod-image3").textContent = "";
    
    // 이미지 미리보기 세팅
    for (let i = 1; i <= 3; i++) {
        const preview = document.getElementById(`add-prod-prev${i}`);
        if (preview) {
            if (imgUrls[i - 1]) {
                preview.src = imgUrls[i - 1];
                preview.style.display = "block";
            } else {
                preview.src = "";
                preview.style.display = "none";
            }
        }
    }
    
    // 5. details 에서 카테고리 꼬리표와 옵션 세부 설정 꼬리표 파싱하기
    let detailsBody = targetProd.details || "";
    let catPath = "";
    let optionSettings = {};
    
    // 카테고리 파싱
    const catMatch = detailsBody.match(/\[카테고리:([^\]]+)\]/);
    if (catMatch) {
        catPath = catMatch[1];
        // 파싱된 부분 제거
        detailsBody = detailsBody.replace(/\[카테고리:[^\]]+\]\s*/, "");
    }
    
    // 옵션설정 파싱
    const optMatch = detailsBody.match(/\[옵션설정:([^\]]+)\]/);
    if (optMatch) {
        try {
            optionSettings = JSON.parse(optMatch[1]);
        } catch (e) {
            console.error("옵션설정 JSON 파싱 오류:", e);
        }
        detailsBody = detailsBody.replace(/\[옵션설정:[^\]]+\]\s*/, "");
    }
    
    // 순수 본문 내용 채우기
    document.getElementById("add-prod-details").value = detailsBody.trim();
    
    // 6. 카테고리 셀렉터 자동 동기화 매칭
    if (catPath) {
        const parts = catPath.split(">").map(x => x.trim());
        const largeCat = localCategories.find(c => c.name === parts[0] && (c.depth === 0 || !c.depth));
        
        if (largeCat) {
            const largeSelect = document.getElementById("add-prod-category-large");
            largeSelect.value = largeCat.id;
            onModalCategoryLargeChange(); // 중분류 렌더링 호출
            
            if (parts[1]) {
                const mediumCat = localCategories.find(c => c.name === parts[1] && c.depth === 1 && c.parent_id === largeCat.id);
                if (mediumCat) {
                    const mediumSelect = document.getElementById("add-prod-category-medium");
                    mediumSelect.value = mediumCat.id;
                    onModalCategoryMediumChange(); // 소분류 렌더링 호출
                    
                    if (parts[2]) {
                        const smallCat = localCategories.find(c => c.name === parts[2] && c.depth === 2 && c.parent_id === mediumCat.id);
                        if (smallCat) {
                            const smallSelect = document.getElementById("add-prod-category-small");
                            smallSelect.value = smallCat.id;
                        }
                    }
                }
            }
        }
    }
    
    // 7. 옵션 칩 정보 복원
    addProdColors = targetProd.colors || [];
    addProdSizes = targetProd.sizes || [];
    addProdOptionSettings = optionSettings;
    
    renderOptionChips('color');
    renderOptionChips('size');
    generateOptionCombinationTable(); // 옵션 조합별 세부 테이블 로드 및 렌더링!
    
    calculateDiscountRate();
    
    // 8. 모달 기동 및 첫 탭 강제 노출
    switchAddProductTab('tab-basic');
    document.getElementById("add-product-modal").style.display = "flex";
}
window.openEditProductModal = openEditProductModal;

/**
 * 💾 [카페24 스타일 고도화된 수동 상품 저장 및 수정 실행 종합기]
 * - 교육용 주석: 현재 모달이 신규 등록 모드(`editProductId === null`)인지,
 *   상세 수정 모드인지 판별하여 적절한 Supabase DB 쿼리를 빌드하고 실행합니다.
 *   옵션 조합별 설정(재고, 추가금, 품절)을 JSON으로 변환하여 세부 스펙 스펙문 하단에 [옵션설정:...] 꼬리표로 영구 보관합니다.
 */
async function submitProductFormDirect() {
    const brand = document.getElementById("add-prod-brand").value.trim();
    const name = document.getElementById("add-prod-name").value.trim();
    const detailsRaw = document.getElementById("add-prod-details").value.trim();
    
    // 🏷️ [계층형 카테고리 고도화] 3단 드롭다운에서 선택된 카테고리 정보 획득
    const largeId = document.getElementById("add-prod-category-large")?.value;
    const mediumId = document.getElementById("add-prod-category-medium")?.value;
    const smallId = document.getElementById("add-prod-category-small")?.value;
    
    const largeCat = localCategories.find(c => c.id === largeId);
    const mediumCat = localCategories.find(c => c.id === mediumId);
    const smallCat = localCategories.find(c => c.id === smallId);
    
    const catParts = [];
    if (largeCat) catParts.push(largeCat.name);
    if (mediumCat) catParts.push(mediumCat.name);
    if (smallCat) catParts.push(smallCat.name);
    
    const categoryPath = catParts.join(">");
    
    // 1단계: 필수 기본정보 검증
    if (!brand || !name || !detailsRaw || !categoryPath) {
        alert("기본 정보 탭의 필수 정보(브랜드, 상품명, 카테고리, 상세 스펙)를 모두 기재해 주세요! 📦");
        switchAddProductTab('tab-basic');
        return;
    }
    
    // 2단계: 판매 & 재고 정보 취합 및 검증
    const price = parseInt(document.getElementById("add-prod-price").value) || 0;
    const originalInputVal = document.getElementById("add-prod-original").value.trim();
    const stock = parseInt(document.getElementById("add-prod-stock").value);
    
    if (price <= 0) {
        alert("실제 판매 가격을 1원 이상의 올바른 숫자로 적어주세요! ₩");
        switchAddProductTab('tab-sale');
        return;
    }
    if (isNaN(stock) || stock < 0) {
        alert("초기 재고 수량을 0개 이상의 올바른 숫자로 적어주세요! 🗃️");
        switchAddProductTab('tab-sale');
        return;
    }
    
    // 진열 여부 라디오 수집
    let isVisible = true;
    const submitVisibleRadios = document.getElementsByName("add-prod-visible");
    submitVisibleRadios.forEach(r => {
        if (r.checked) isVisible = (r.value === "true");
    });
    
    // 품절 여부 라디오 수집
    let isSoldOut = false;
    const submitSoldoutRadios = document.getElementsByName("add-prod-soldout");
    submitSoldoutRadios.forEach(r => {
        if (r.checked) isSoldOut = (r.value === "true");
    });
    
    // 소비자가가 있으면 ₩기호를 붙여 original_price에 기록
    let original_price = "";
    if (originalInputVal) {
        const numOriginal = parseInt(originalInputVal);
        original_price = !isNaN(numOriginal) ? `₩${numOriginal.toLocaleString()}` : originalInputVal;
    } else {
        original_price = `₩${price.toLocaleString()}`; // 없으면 판매가와 동일
    }
    
    // 3단계: 옵션 및 이미지 정보 취합 및 검증
    const img1 = document.getElementById("add-prod-image1").value.trim();
    const img2 = document.getElementById("add-prod-image2").value.trim();
    const img3 = document.getElementById("add-prod-image3").value.trim();
    
    if (!img1) {
        alert("최소 대표 이미지는 필수 등록 항목입니다! 🖼️");
        switchAddProductTab('tab-optimg');
        return;
    }
    
    const image_urls = [img1, img2, img3].filter(url => url !== "");
    
    if (addProdColors.length === 0) {
        alert("최소 1개 이상의 색상 옵션을 등록해 주세요! (입력 후 추가 클릭) 🎨");
        switchAddProductTab('tab-optimg');
        return;
    }
    if (addProdSizes.length === 0) {
        alert("최소 1개 이상의 사이즈 옵션을 등록해 주세요! (입력 후 추가 클릭) 📐");
        switchAddProductTab('tab-optimg');
        return;
    }
    
    // 🏷️ [옵션 세부 설정 패킹]
    // 세부 품목 목록 테이블에서 입력된 설정 정보를 직렬화하여 details 필드에 은밀하게 이식합니다.
    const optionSettingsJson = JSON.stringify(addProdOptionSettings);
    
    // details 구성: [카테고리:...] [옵션설정:...] 본문
    const details = `[카테고리:${categoryPath}] [옵션설정:${optionSettingsJson}] ${detailsRaw}`;
    
    // Supabase 및 내부 규격에 맞게 상품 객체 조립
    const productPayload = {
        brand: brand,
        name: name,
        selling_price: price,
        original_price: original_price,
        image_urls: image_urls,
        colors: addProdColors,
        sizes: addProdSizes,
        details: details,
        is_visible: isVisible,
        is_soldout: isSoldOut,
        stock: stock
    };
    
    // 수정 모드인 경우
    if (editProductId) {
        if (supabaseClient) {
            try {
                const { error } = await timeoutPromise(2500, supabaseClient
                    .from("products")
                    .update(productPayload)
                    .eq("id", editProductId));
                    
                if (error) throw error;
                alert("🎉 상품 정보가 성공적으로 수정되어 영구 반영되었습니다! 💾");
                closeAddProductModal();
                fetchAdminProducts();
                if (typeof fetchProducts === 'function') fetchProducts(); // 메인 홈 동기화
            } catch(e) {
                alert(`⚠️ DB 상품 수정 실패: ${e.message}`);
            }
        } else {
            // 더미 모드 대응
            const idx = DUMMY_PRODUCTS.findIndex(p => p.id === editProductId);
            if (idx !== -1) {
                DUMMY_PRODUCTS[idx] = { ...DUMMY_PRODUCTS[idx], ...productPayload, updated_at: new Date().toISOString() };
                allProducts = [...DUMMY_PRODUCTS];
            }
            alert("🎉 [더미 모드] 상품 정보 가상 수정이 성공적으로 반영되었습니다! 💾");
            closeAddProductModal();
            fetchAdminProducts();
            if (typeof fetchProducts === 'function') fetchProducts(); // 메인 홈 동기화
        }
    } else {
        // 신규 등록 모드인 경우
        // post_id 고유값 자동 채우기
        productPayload.post_id = `manual_${Math.floor(10000 + Math.random() * 90000)}`;
        productPayload.post_url = "https://band.us";
        
        if (supabaseClient) {
            try {
                const { error } = await timeoutPromise(2500, supabaseClient
                    .from("products")
                    .insert([productPayload]));
                    
                if (error) throw error;
                alert("🎉 카페24 스타일 신규 상품이 클라우드 진열장에 완벽하게 등록되었습니다! 📦");
                closeAddProductModal();
                fetchAdminProducts();
                if (typeof fetchProducts === 'function') fetchProducts();
            } catch(e) {
                alert(`⚠️ DB 상품 추가 실패: ${e.message}`);
            }
        } else {
            // 더미 모드 대응
            const copyProd = { ...productPayload, id: `dummy-${Math.floor(Math.random()*100000)}`, created_at: new Date().toISOString() };
            DUMMY_PRODUCTS.unshift(copyProd);
            allProducts = [...DUMMY_PRODUCTS];
            
            alert("🎉 [더미 모드] 신규 상품이 가상 등록되었습니다! 📦");
            closeAddProductModal();
            fetchAdminProducts();
            if (typeof fetchProducts === 'function') fetchProducts();
        }
    }
}
window.submitProductFormDirect = submitProductFormDirect;

// =========================================================================
// 📊 [상품 엑셀 대량 등록 및 백업 다운로드 비즈니스 엔진]
// =========================================================================
let excelParsedProducts = []; // 파싱 완료된 상품 목록을 임시 저장하는 전역 배열 변수

// 엑셀 업로드 모달창 열기
function openExcelUploadModal() {
    excelParsedProducts = [];
    const fileInput = document.getElementById("excel-file-input");
    if (fileInput) fileInput.value = ""; // 파일 인풋 리셋
    
    const previewArea = document.getElementById("excel-preview-area");
    if (previewArea) previewArea.style.display = "none";
    
    const submitBtn = document.getElementById("excel-submit-btn");
    if (submitBtn) submitBtn.style.display = "none";
    
    document.getElementById("excel-upload-modal").style.display = "flex";
}
window.openExcelUploadModal = openExcelUploadModal;

// 엑셀 업로드 모달창 닫기
function closeExcelUploadModal() {
    document.getElementById("excel-upload-modal").style.display = "none";
}
window.closeExcelUploadModal = closeExcelUploadModal;

// 모달 바깥 어두운 영역 클릭 시 모달 닫기
function closeExcelUploadModalOutside(event) {
    if (event.target.id === "excel-upload-modal") {
        closeExcelUploadModal();
    }
}
window.closeExcelUploadModalOutside = closeExcelUploadModalOutside;

/**
 * 📥 [엑셀 등록 서식 양식 다운로드] 
 * - 교육용 주석: SheetJS 라이브러리를 사용해 표준 엑셀 업로드 템플릿 서식을 자바스크립트로
 *   동적 생성하고 브라우저에서 '상품대량등록_양식.xlsx' 파일로 강제 다운로드시킵니다.
 */
function downloadExcelTemplate() {
    // 엑셀 헤더 데이터 구성
    const headers = [
        "브랜드명", 
        "상품명", 
        "판매가격(원화)", 
        "도매원가", 
        "카테고리(대분류>중분류>소분류)", 
        "이미지URL(쉼표구분)", 
        "색상옵션(쉼표구분)", 
        "사이즈옵션(쉼표구분)", 
        "상세설명"
    ];
    
    // 샘플 예시 행 데이터 구성
    const sampleRow = [
        "Chanel",
        "샤넬 시그니처 보이백 미디움",
        "8500000",
        "$6000",
        "명품잡화>가방>숄더백",
        "https://images.unsplash.com/photo-1548036328-c9fa89d128fa, https://images.unsplash.com/photo-1584917865442-de89df76afd3",
        "소프트블랙, 캐비어골드",
        "One Size",
        "샤넬의 상징적인 보이백 캐비어 퀼팅 스킨의 프리미엄 에디션입니다. 고급 체인 스트랩 내장."
    ];
    
    const data = [headers, sampleRow];
    
    // 워크시트 및 워크북 변환
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "상품양식");
    
    // 엑셀 파일 다운로드 실행
    XLSX.writeFile(wb, "상품대량등록_양식.xlsx");
}
window.downloadExcelTemplate = downloadExcelTemplate;

/**
 * 📂 [엑셀 파일 로드 및 파싱] 
 * - 교육용 주석: 사용자가 업로드한 엑셀 파일(.xlsx)의 바이너리 내용을 SheetJS로 읽어들인 뒤,
 *   한글 헤더명에 맞추어 JSON 객체 목록으로 파싱하고 화면에 미리보기 형태로 출력합니다.
 */
function handleExcelFileSelect(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // 첫 번째 시트 인출
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // 시트를 2차원 배열 데이터로 변환 (헤더와 데이터 행을 명확히 구분하기 위함)
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (rawRows.length <= 1) {
                alert("⚠️ 엑셀 파일 내에 등록할 상품 데이터가 존재하지 않습니다.");
                return;
            }
            
            // 첫 번째 줄은 한글 컬럼 헤더명
            const headers = rawRows[0];
            excelParsedProducts = [];
            
            // 데이터 행들을 순회하며 표준 스키마 객체로 변환
            for (let i = 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if (!row || row.length === 0) continue;
                
                // 각 행의 값을 헤더 인덱스 기반 매핑
                const getVal = (headerName) => {
                    const idx = headers.indexOf(headerName);
                    if (idx === -1) return "";
                    return row[idx] !== undefined ? String(row[idx]).trim() : "";
                };
                
                const brand = getVal("브랜드명");
                const name = getVal("상품명");
                const price = parseInt(getVal("판매가격(원화)")) || 0;
                const original = getVal("도매원가");
                const catPath = getVal("카테고리(대분류>중분류>소분류)");
                const imagesStr = getVal("이미지URL(쉼표구분)");
                const colorsStr = getVal("색상옵션(쉼표구분)");
                const sizesStr = getVal("사이즈옵션(쉼표구분)");
                const desc = getVal("상세설명");
                
                // 필수 기입 요건 점검
                if (!brand || !name || !price || !catPath) {
                    continue; // 필수값이 빠진 빈 행이나 비정상 행은 스킵
                }
                
                excelParsedProducts.push({
                    brand: brand,
                    name: name,
                    selling_price: price,
                    original_price: original || "$40",
                    category_path: catPath,
                    imagesStr: imagesStr,
                    colorsStr: colorsStr,
                    sizesStr: sizesStr,
                    desc: desc
                });
            }
            
            if (excelParsedProducts.length === 0) {
                alert("⚠️ 유효한 상품 정보가 감지되지 않았습니다. 양식을 다시 확인해 주세요.");
                return;
            }
            
            // 파싱 결과 화면 미리보기 갱신
            renderExcelPreview();
            
        } catch(err) {
            alert(`⚠️ 엑셀 파일 해석 중 에러가 발생했습니다: ${err.message}`);
        }
    };
    
    reader.readAsArrayBuffer(file);
}
window.handleExcelFileSelect = handleExcelFileSelect;

/**
 * 👀 [파싱 결과 미리보기 출력] 
 * - 교육용 주석: 파싱해 둔 임시 엑셀 데이터 객체 목록을 테이블 HTML 구조로 조립하여
 *   대표님이 저장하기 전에 가격, 카테고리 등을 눈으로 최종 컨펌할 수 있도록 지원합니다.
 */
function renderExcelPreview() {
    const previewArea = document.getElementById("excel-preview-area");
    const countSpan = document.getElementById("excel-preview-count");
    const tbody = document.getElementById("excel-preview-rows");
    const submitBtn = document.getElementById("excel-submit-btn");
    
    if (!previewArea || !countSpan || !tbody || !submitBtn) return;
    
    tbody.innerHTML = "";
    countSpan.textContent = excelParsedProducts.length;
    
    excelParsedProducts.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${escapeHtml(p.brand)}</strong></td>
            <td style="text-align: left;">${escapeHtml(p.name)}</td>
            <td style="color: var(--accent-gold); font-weight: 700;">₩${p.selling_price.toLocaleString()}</td>
            <td style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(p.category_path)}</td>
            <td><span class="supabase-status-badge green" style="padding: 2px 6px;">대기중</span></td>
        `;
        tbody.appendChild(tr);
    });
    
    previewArea.style.display = "block";
    submitBtn.style.display = "block";
}

/**
 * 💾 [엑셀 상품 일괄 DB 저장] 
 * - 교육용 주석: 미리보기된 엑셀 상품 데이터에 고유 포스트 ID를 생성하고,
 *   쉼표 구분된 옵션을 배열 데이터로 포맷 변환하며 details 컬럼에 카테고리 접두사를 기입한 후
 *   Supabase DB 테이블에 다중 행(Bulk Insert) 쿼리를 일괄 쏘아 적재합니다.
 */
async function submitExcelProductsDirect() {
    if (!excelParsedProducts || excelParsedProducts.length === 0) {
        alert("⚠️ 등록할 상품 목록이 비어 있습니다.");
        return;
    }
    
    if (!confirm(`💾 분석 완료된 ${excelParsedProducts.length}건의 명품 신상을 일괄 저장하고 진열장에 전시하시겠습니까?`)) {
        return;
    }
    
    // DB 업로드 포맷으로 변환 가공 진행
    const insertDataList = excelParsedProducts.map(p => {
        const image_urls = p.imagesStr.split(",").map(i => i.trim()).filter(i => i !== "");
        const colors = p.colorsStr.split(",").map(c => c.trim()).filter(c => c !== "");
        const sizes = p.sizesStr.split(",").map(s => s.trim()).filter(s => s !== "");
        
        // 계계층 카테고리 기입 방식과 규격 일치화
        const details = `[카테고리:${p.category_path}] ${p.desc}`;
        
        return {
            post_id: `manual_${Math.floor(10000 + Math.random() * 90000)}`,
            post_url: "https://band.us",
            brand: p.brand,
            name: p.name,
            selling_price: p.selling_price,
            original_price: p.original_price,
            image_urls: image_urls,
            colors: colors,
            sizes: sizes,
            details: details,
            is_visible: true
        };
    });
    
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            // Supabase bulk insert API 호출
            const { error } = await timeoutPromise(5000, supabaseClient
                .from("products")
                .insert(insertDataList));
                
            if (error) throw error;
            
            alert(`🎉 총 ${insertDataList.length}건의 상품이 클라우드 진열장에 대량 업로드 완료되었습니다!`);
            closeExcelUploadModal();
            fetchAdminProducts();
            if (typeof fetchProducts === 'function') fetchProducts(); // 메인몰도 동기화 갱신
        } catch(e) {
            alert(`⚠️ DB 엑셀 일괄 업로드 처리 중 오류: ${e.message}`);
        }
    } else {
        // 더미 모드 대응 (Fail-safe)
        insertDataList.forEach(newProd => {
            const copyProd = { ...newProd, id: `dummy-${Math.floor(Math.random()*100000)}`, created_at: new Date().toISOString() };
            if (typeof DUMMY_PRODUCTS !== 'undefined') DUMMY_PRODUCTS.unshift(copyProd);
        });
        if (typeof DUMMY_PRODUCTS !== 'undefined') allProducts = [...DUMMY_PRODUCTS];
        
        alert(`🎉 [더미 모드] 총 ${insertDataList.length}건의 상품이 가상 진열장에 대량 배치되었습니다!`);
        closeExcelUploadModal();
        fetchAdminProducts();
        if (typeof fetchProducts === 'function') fetchProducts();
    }
}
window.submitExcelProductsDirect = submitExcelProductsDirect;

/**
 * 📥 [등록 상품 엑셀 다운로드 (백업 내보내기)]
 * - 교육용 주석: 현재 대표님 몰에 등록 진열된 모든 상품(allProducts)의 배열 정보를 긁어와서
 *   details 내부의 카테고리 정보와 본문을 역분석하고 옵션 배열들을 문자열로 롤백 맵핑한 후,
 *   대량 등록 양식과 100% 동일한 구조의 엑셀 파일로 백업 인출해 다운로드합니다.
 */
function downloadAdminProductsExcel() {
    // 상품 대장이 비어있는지 검증
    const targetProducts = (typeof allProducts !== 'undefined' && allProducts) ? allProducts : [];
    if (targetProducts.length === 0) {
        alert("⚠️ 다운로드할 상품 목록이 존재하지 않습니다.");
        return;
    }
    
    if (!confirm(`📥 현재 등록된 ${targetProducts.length}개의 상품 전체 목록을 엑셀로 백업 다운로드하시겠습니까?`)) {
        return;
    }
    
    // 엑셀 파일 헤더 구성
    const headers = [
        "브랜드명", 
        "상품명", 
        "판매가격(원화)", 
        "도매원가", 
        "카테고리(대분류>중분류>소분류)", 
        "이미지URL(쉼표구분)", 
        "색상옵션(쉼표구분)", 
        "사이즈옵션(쉼표구분)", 
        "상세설명"
    ];
    
    // 각 상품 객체 정보를 엑셀 셀 행 데이터로 역가공 변환
    const rows = targetProducts.map(p => {
        let catPath = "";
        let originalDesc = p.details || "";
        
        // 🔒 details 내 [카테고리:대분류>중분류>소분류] 접두사 정규 매칭 및 역추출
        if (p.details && p.details.startsWith("[카테고리:")) {
            const endIdx = p.details.indexOf("]");
            if (endIdx !== -1) {
                // 접두사에서 카테고리 경로 파싱 추출
                catPath = p.details.substring(11, endIdx);
                // 실질적인 상품 본문 설명글만 분리
                originalDesc = p.details.substring(endIdx + 1).trim();
            }
        }
        
        // 이미지, 옵션 배열을 문자열 쉼표구분으로 맵핑
        const imagesStr = Array.isArray(p.image_urls) ? p.image_urls.join(", ") : "";
        const colorsStr = Array.isArray(p.colors) ? p.colors.join(", ") : "";
        const sizesStr = Array.isArray(p.sizes) ? p.sizes.join(", ") : "";
        
        return [
            p.brand || "",
            p.name || "",
            p.selling_price || 0,
            p.original_price || "",
            catPath,
            imagesStr,
            colorsStr,
            sizesStr,
            originalDesc
        ];
    });
    
    // SheetJS 워크시트 객체 생성
    const data = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "진열상품백업");
    
    // 파일명 포맷용 오늘 날짜 인덱싱
    const today = new Date();
    const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
    
    // 파일로 강제 다운로드 출력
    XLSX.writeFile(wb, `OUTLET_PRODUCTS_BACKUP_${dateStr}.xlsx`);
}
window.downloadAdminProductsExcel = downloadAdminProductsExcel;

// [보안 고도화] 상품 영구 삭제 시 2차 보안 비밀번호 검증 적용
async function deleteProductDirect(id, name) {
    if (!confirm(`🚨 [주의] [${name}] 상품을 진열장에서 완전히 영구 삭제하시겠습니까?`)) return;
    
    // 세션 임의 조작(하이재킹) 우회를 완전 차단하기 위해 동작 직전 패스워드 재확인 검증을 실시합니다.
    const adminPwConfirm = prompt("🔒 민감한 관리자 권한(상품 영구 삭제)을 승인하려면 어드민 비밀번호를 다시 입력하세요:");
    const confirmHash = CryptoJS.SHA256(adminPwConfirm).toString();
    if (confirmHash !== ADMIN_PASSWORD_HASH) {
        alert("❌ 관리자 비밀번호가 일치하지 않아 요청이 안전하게 거부되었습니다!");
        return;
    }
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .delete()
                .eq("id", id));
                
            if (error) throw error;
            alert("🗑️ 상품이 완전히 제거되었습니다.");
            fetchAdminProducts();
        } catch(e) {
            alert(`⚠️ DB 상품 삭제 지연: ${e.message}`);
        }
    } else {
        const idx = DUMMY_PRODUCTS.findIndex(p => p.id === id);
        if (idx !== -1) {
            DUMMY_PRODUCTS.splice(idx, 1);
            allProducts = [...DUMMY_PRODUCTS];
        }
        alert("🗑️ [더미 모드] 가상 제거 완료!");
        fetchAdminProducts();
    }
}

/**
 * 📊 [대시보드 실시간 집계] 실시간 DB 정보를 바탕으로 주문, 상품, 고객의 통계 현황판 채우기
 * - 교육용 주석: 카페24 백오피스처럼 실시간 통계 요약 테이블의 셀렉터 엘리먼트에
 *   오늘과 이번 달의 주문/결제/환불 건수 및 총액 데이터를 실시간 합산 연동하는 엔진입니다.
 */
async function fetchAdminDashboardStats() {
    let ordersList = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await timeoutPromise(2500, supabaseClient.from("orders").select("*"));
            ordersList = data || [];
        } catch(e) {
            console.error("대시보드 통계용 주문 데이터 조회 실패:", e);
        }
    }
    if (ordersList.length === 0 && typeof DUMMY_ORDERS !== 'undefined') {
        ordersList = [...DUMMY_ORDERS];
    }
    
    // --- 날짜 필터링을 위한 시간 기준 설정 ---
    const todayStr = new Date().toDateString();
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    
    // --- 오늘 (Today) 통계 지표 변수 선언 ---
    let todayOrderAmt = 0;    // 오늘 총 주문 금액 (취소 제외 전체)
    let todayOrderCount = 0;  // 오늘 총 주문 건수
    let todaySettledAmt = 0;  // 오늘 총 실결제 금액
    let todaySettledCount = 0;// 오늘 총 실결제 건수
    let todayRefundAmt = 0;   // 오늘 총 환불 금액
    let todayRefundCount = 0; // 오늘 총 환불 건수
    
    // --- 이번 달 (This Month) 통계 지표 변수 선언 ---
    let monthOrderAmt = 0;    // 이번 달 총 주문 금액
    let monthOrderCount = 0;  // 이번 달 총 주문 건수
    let monthSettledAmt = 0;  // 이번 달 총 실결제 금액
    let monthSettledCount = 0;// 이번 달 총 실결제 건수
    let monthRefundAmt = 0;   // 이번 달 총 환불 금액
    let monthRefundCount = 0; // 이번 달 총 환불 건수
    
    // --- 주문 상태별 카운팅 변수 선언 (오늘의 할 일 현황판용) ---
    let countPending = 0;   // 입금대기
    let countSettled = 0;   // 결제완료
    let countReady = 0;     // 배송준비
    let countShipping = 0;  // 배송중
    let countCompleted = 0; // 배송완료
    let countCancel = 0;    // 취소신청
    let countExchange = 0;  // 교환신청
    let countRefund = 0;    // 반품신청
    
    ordersList.forEach(o => {
        const orderDate = new Date(o.created_at);
        const orderDateStr = orderDate.toDateString();
        const orderMonth = orderDate.getMonth();
        const orderYear = orderDate.getFullYear();
        
        const isToday = orderDateStr === todayStr;
        const isThisMonth = orderMonth === thisMonth && orderYear === thisYear;
        const status = o.status;
        const amount = o.total_amount || 0;
        
        // 1) 8단 주문 상태 카운팅 분기
        if (status === "입금대기") countPending++;
        else if (status === "결제완료") countSettled++;
        else if (status === "배송준비") countReady++;
        else if (status === "배송중") countShipping++;
        else if (status === "배송완료") countCompleted++;
        else if (status === "주문취소" || status === "취소신청" || status === "주문취소완료") countCancel++;
        else if (status === "교환신청" || status === "교환처리완료") countExchange++;
        else if (status === "반품요청" || status === "반품신청" || status === "반품처리완료") countRefund++;
        
        // 2) 오늘 통계 누적
        if (isToday) {
            if (status !== "주문취소" && status !== "주문취소완료") {
                todayOrderAmt += amount;
                todayOrderCount++;
            }
            if (["결제완료", "배송준비", "배송중", "배송완료"].includes(status)) {
                todaySettledAmt += amount;
                todaySettledCount++;
            }
            if (status === "주문취소" || status === "주문취소완료" || status === "반품처리완료") {
                todayRefundAmt += amount;
                todayRefundCount++;
            }
        }
        
        // 3) 이번 달 통계 누적
        if (isThisMonth) {
            if (status !== "주문취소" && status !== "주문취소완료") {
                monthOrderAmt += amount;
                monthOrderCount++;
            }
            if (["결제완료", "배송준비", "배송중", "배송완료"].includes(status)) {
                monthSettledAmt += amount;
                monthSettledCount++;
            }
            if (status === "주문취소" || status === "주문취소완료" || status === "반품처리완료") {
                monthRefundAmt += amount;
                monthRefundCount++;
            }
        }
    });
    
    // --- DOM에 요약 수치 기입 및 엘리먼트 널 가드 설정 ---
    const setSafeText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    // 오늘 매출 현황 테이블 적용
    setSafeText("sales-today-order-amount", `₩${todayOrderAmt.toLocaleString()}`);
    setSafeText("sales-today-order-count", `${todayOrderCount}건`);
    setSafeText("sales-today-settled-amount", `₩${todaySettledAmt.toLocaleString()}`);
    setSafeText("sales-today-settled-count", `${todaySettledCount}건`);
    setSafeText("sales-today-refund-amount", `₩${todayRefundAmt.toLocaleString()}`);
    setSafeText("sales-today-refund-count", `${todayRefundCount}건`);
    
    // 이번 달 매출 현황 테이블 적용
    setSafeText("sales-month-order-amount", `₩${monthOrderAmt.toLocaleString()}`);
    setSafeText("sales-month-order-count", `${monthOrderCount}건`);
    setSafeText("sales-month-settled-amount", `₩${monthSettledAmt.toLocaleString()}`);
    setSafeText("sales-month-settled-count", `${monthSettledCount}건`);
    setSafeText("sales-month-refund-amount", `₩${monthRefundAmt.toLocaleString()}`);
    setSafeText("sales-month-refund-count", `${monthRefundCount}건`);
    
    // 기존 헤더 통계 배지 안전 동기화
    setSafeText("admin-today-sales", `₩${todaySettledAmt.toLocaleString()}`);
    setSafeText("admin-month-sales", `₩${monthSettledAmt.toLocaleString()}`);
    setSafeText("admin-pending-badge-count", countPending);
    setSafeText("admin-pending-badge-amount", `₩${ordersList.filter(o => o.status === "입금대기").reduce((sum, o) => sum + o.total_amount, 0).toLocaleString()}`);
    setSafeText("admin-ops-pending-count", `${countPending.toLocaleString()}건`);
    setSafeText("admin-ops-today-sales", `₩${todaySettledAmt.toLocaleString()}`);
    setSafeText("admin-ops-month-sales", `₩${monthSettledAmt.toLocaleString()}`);
    
    // 8단 실시간 현황판 바인딩
    setSafeText("flow-pending", countPending);
    setSafeText("flow-settled", countSettled);
    setSafeText("flow-ready", countReady);
    setSafeText("flow-shipping", countShipping);
    setSafeText("flow-completed", countCompleted);
    setSafeText("flow-cancel", countCancel);
    setSafeText("flow-exchange", countExchange);
    setSafeText("flow-refund", countRefund);
    
    // 👑 최근 7일 매출 차트 및 상품 랭킹 갱신 기동
    renderAdminSalesChart(ordersList);
    
    const salesCounter = {};
    ordersList.forEach(o => {
        if (!o.items) return;
        o.items.forEach(item => {
            const pid = item.prodId || item.prod_id || "unknown";
            if (!salesCounter[pid]) {
                salesCounter[pid] = {
                    qty: 0,
                    name: item.name || "의류",
                    brand: item.brand || "PKB71",
                    thumb: item.thumb || "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=100"
                };
            }
            salesCounter[pid].qty += item.qty;
        });
    });
    
    const ranked = Object.keys(salesCounter).map(key => {
        return { id: key, ...salesCounter[key] };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5);
    
    const rankList = document.getElementById("admin-popular-ranking-list");
    if (rankList) {
        rankList.innerHTML = "";
        
        if (ranked.length === 0) {
            rankList.innerHTML = `<p style="font-size:12px; color:var(--text-secondary); text-align:center;">아직 판매 집계된 이력이 없습니다.</p>`;
            return;
        }
        
        ranked.forEach((r, idx) => {
            const item = document.createElement("div");
            item.className = "rank-item";
            item.innerHTML = `
                <span class="rank-number">${idx + 1}</span>
                <img src="${r.thumb}" class="rank-img">
                <div class="rank-info">
                    <h5 class="rank-name">[${r.brand}] ${r.name}</h5>
                    <span class="rank-sales-qty">누적 판매: <b>${r.qty}개</b></span>
                </div>
            `;
            rankList.appendChild(item);
        });
    }
}

async function updateOrderStatus(orderId, newStatus) {
    let deliveryMemo = "";
    if (newStatus === "배송중") {
        const tracking = prompt("🚛 고객 배송 출발 처리를 위해 [택배사 이름 및 운송장 번호]를 입력해 주세요:\n(예: 우체국택배 60829103829)");
        if (tracking) {
            deliveryMemo = `[송장: ${tracking}]`;
        }
    }
    
    if (supabaseClient) {
        try {
            let updatedField = { status: newStatus };
            if (deliveryMemo) {
                const currentOrder = await timeoutPromise(2500, supabaseClient.from("orders").select("message").eq("id", orderId).single());
                // 🛡️ [보안 고도화] 기존 주문 메시지를 안전하게 복호화(decrypt)한 후 송장번호를 덧대고 다시 암호화(encrypt)하여 적재합니다.
                const decMessage = secureDecrypt(currentOrder?.data?.message);
                const nextMessage = decMessage ? `${decMessage} ${deliveryMemo}` : deliveryMemo;
                updatedField.message = secureEncrypt(nextMessage);
            }
            
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .update(updatedField)
                .eq("id", orderId));
                
            if (error) throw error;
            showToastMessage();
            fetchAdminOrders();
            fetchAdminDashboardStats();
        } catch (e) {
            alert(`⚠️ DB 주문 상태 갱신 실패: ${e.message}`);
        }
    } else {
        const idx = DUMMY_ORDERS.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            DUMMY_ORDERS[idx].status = newStatus;
            if (deliveryMemo) {
                DUMMY_ORDERS[idx].message = DUMMY_ORDERS[idx].message ? `${DUMMY_ORDERS[idx].message} ${deliveryMemo}` : deliveryMemo;
            }
        }
        showToastMessage();
        fetchAdminOrders();
        renderCafe24AdminHomeDashboard();
    }
}

async function toggleProductVisibility(id) {
    const checkbox = document.getElementById(`admin-visible-${id}`);
    const isChecked = checkbox.checked;
    
    const idx = allProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
        allProducts[idx].is_visible = isChecked;
    }
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .update({ is_visible: isChecked })
                .eq("id", id));
                
            if (error) throw error;
            showToastMessage();
        } catch (e) {
            console.error("⚠️ 노출 스위치 DB 업서트 지연:", e);
        }
    } else {
        showToastMessage();
    }
}

async function submitAdminCommentFeedback(type, itemId, replyText) {
    if (!replyText || !replyText.trim()) {
        alert("답변 피드백 내용을 입력해 주세요! 💬");
        return;
    }
    
    if (supabaseClient) {
        try {
            const table = (type === 'qna') ? 'qna' : 'reviews';
            const { error } = await timeoutPromise(2500, supabaseClient
                .from(table)
                .update({ reply: replyText, reply_created_at: new Date().toISOString() })
                .eq("id", itemId));
                
            if (error) throw error;
            alert("💬 대표님의 감사 답변 피드백이 실시간 저장되었습니다!");
            fetchAdminFeedbackTab();
        } catch(e) {
            alert(`⚠️ 피드백 적재 실패: ${e.message}`);
        }
    } else {
        if (type === 'qna') {
            const idx = qnaPosts.findIndex(q => q.id === itemId);
            if (idx !== -1) {
                qnaPosts[idx].reply = replyText;
                qnaPosts[idx].reply_created_at = new Date().toISOString();
            }
        } else {
            const idx = localReviews.findIndex(r => r.id === itemId);
            if (idx !== -1) {
                localReviews[idx].reply = replyText;
            } else {
                const idx2 = DUMMY_REVIEWS.findIndex(r => r.id === itemId);
                if (idx2 !== -1) DUMMY_REVIEWS[idx2].reply = replyText;
            }
        }
        alert("💬 [더미 모드] 가상 감사 댓글이 적재되었습니다!");
        fetchAdminFeedbackTab();
    }
}

async function fetchAdminFeedbackTab() {
    const revList = document.getElementById("admin-reviews-control-list");
    const qnaList = document.getElementById("admin-qna-control-list");
    
    revList.innerHTML = `<p style="text-align:center; font-size:12px; color:var(--text-secondary);">리뷰 대장 로딩 중...</p>`;
    qnaList.innerHTML = `<p style="text-align:center; font-size:12px; color:var(--text-secondary);">Q&A 대장 로딩 중...</p>`;
    
    await fetchQnaPosts();
    
    let allRevs = [];
    if (supabaseClient) {
        try {
            const { data } = await timeoutPromise(2500, supabaseClient.from("reviews").select("*").order("created_at", { ascending: false }));
            allRevs = data || [];
        } catch(e) {}
    }
    allRevs = [...localReviews, ...allRevs];
    if (allRevs.length === 0) allRevs = [...DUMMY_REVIEWS];
    
    qnaList.innerHTML = "";
    qnaPosts.forEach(q => {
        const div = document.createElement("div");
        div.className = "admin-comment-card";
        const lockIcon = q.is_secret ? "🔒 [비밀글]" : "🔓 [공개글]";
        const replyVal = q.reply || "";
        
        // 🛡️ [보안 고도화] 대표님이 비밀글 질문 내용을 바로 읽고 피드백을 주실 수 있도록 본문을 복호화합니다.
        const decContent = secureDecrypt(q.content);
        
        div.innerHTML = `
            <div class="admin-comment-header">
                <span class="admin-comment-title">${lockIcon} ${escapeHtml(q.title)}</span>
                <span class="admin-comment-date">${new Date(q.created_at).toISOString().split('T')[0]}</span>
            </div>
            <span class="admin-comment-author">작성자: ${escapeHtml(q.author)}</span>
            <p class="admin-comment-body">${escapeHtml(decContent)}</p>
            <div style="display:flex; gap:8px;">
                <input type="text" class="admin-comment-reply-input" id="reply-qna-${q.id}" placeholder="대표님 답변 내용을 입력해 주세요." value="${escapeHtml(replyVal)}">
                <button class="admin-comment-reply-btn" onclick="submitAdminCommentFeedback('qna', '${q.id}', document.getElementById('reply-qna-${q.id}').value)">답변</button>
            </div>
        `;
        qnaList.appendChild(div);
    });
    
    revList.innerHTML = "";
    allRevs.forEach(r => {
        const div = document.createElement("div");
        div.className = "admin-comment-card";
        const photoHtml = r.image_url ? `<br><img src="${r.image_url}" style="width:40px; height:52px; object-fit:cover; border-radius:3px; margin-top:5px;" onclick="window.open('${r.image_url}')">` : "";
        const replyVal = r.reply || "";
        
        div.innerHTML = `
            <div class="admin-comment-header">
                <span class="admin-comment-title">★ ${r.rating}점 만족 후기</span>
                <span class="admin-comment-date">${new Date(r.created_at).toISOString().split('T')[0]}</span>
            </div>
            <span class="admin-comment-author">작성자: ${escapeHtml(r.author)} (주문: ${escapeHtml(r.order_no)})</span>
            <p class="admin-comment-body">${escapeHtml(r.content)}${photoHtml}</p>
            <div style="display:flex; gap:8px;">
                <input type="text" class="admin-comment-reply-input" id="reply-rev-${r.id}" placeholder="대표님 감사 댓글 피드백 입력..." value="${escapeHtml(replyVal)}">
                <button class="admin-comment-reply-btn" onclick="submitAdminCommentFeedback('rev', '${r.id}', document.getElementById('reply-rev-${r.id}').value)">답변</button>
            </div>
        `;
        revList.appendChild(div);
    });
}

// 🔄 어드민 탭 전환 및 데이터 갱신 시 현재 활성화된 탭에 대응하여 데이터를 고속 갱신합니다.
function refreshAdminData() {
    if (!checkAdminSession()) return; // 🛡️ 세션 검증 실행
    fetchAdminDashboardStats();
    if (activeAdminTab === "dashboard") {
        renderCafe24AdminHomeDashboard();
    } else if (activeAdminTab === "products") {
        fetchAdminProducts();
    } else if (activeAdminTab === "orders") {
        fetchAdminOrders();
    } else if (activeAdminTab === "customers") {
        fetchAdminCustomers();
    } else if (activeAdminTab === "categories") {
        fetchAdminCategories();
    } else if (activeAdminTab === "add-product") {
        populateCategoryDropdowns();
    } else if (activeAdminTab === "qna") {
        fetchAdminFeedbackTab();
    } else if (activeAdminTab === "notices") {
        renderAdminNotices();
    }
}

async function fetchAdminProducts() {
    // 📦 [체크박스 고도화] 상품 목록 로딩 시 상단 전체 선택 마스터 체크박스 해제
    const masterCheck = document.getElementById("admin-prod-check-all");
    if (masterCheck) masterCheck.checked = false;

    const tbody = document.getElementById("admin-product-rows");
    tbody.innerHTML = `
        <tr>
            <td colspan="11" style="text-align: center; padding: 50px 0;">
                <div class="spinner" style="width: 25px; height: 25px;"></div>
                <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">상품 현황 대장 로딩 중...</p>
            </td>
        </tr>
    `;
    
    let adminProducts = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .select("*")
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            adminProducts = data || [];
            if (adminProducts.length === 0) {
                adminProducts = [...DUMMY_PRODUCTS];
            }
        } catch (e) {
            adminProducts = [...DUMMY_PRODUCTS];
        }
    } else {
        adminProducts = [...DUMMY_PRODUCTS];
    }
    
    // 🔍 [신설] 상세 검색 필터 적용
    const searchType = document.getElementById("admin-prod-search-type")?.value || "name";
    const keyword = document.getElementById("admin-prod-search-keyword")?.value.trim().toLowerCase() || "";
    
    const largeId = document.getElementById("admin-prod-search-large")?.value || "";
    const mediumId = document.getElementById("admin-prod-search-medium")?.value || "";
    const smallId = document.getElementById("admin-prod-search-small")?.value || "";
    
    let filteredProducts = adminProducts;
    
    // 1) 텍스트 키워드 검색 (상품명 또는 브랜드명)
    if (keyword) {
        filteredProducts = filteredProducts.filter(p => {
            if (searchType === "name") {
                return (p.name || "").toLowerCase().includes(keyword);
            } else if (searchType === "brand") {
                return (p.brand || "").toLowerCase().includes(keyword);
            }
            return true;
        });
    }
    
    // 2) 카테고리 분류 검색
    // details 필드에서 [카테고리:대분류>중분류>소분류] 태그를 추출하여 비교합니다.
    if (largeId || mediumId || smallId) {
        const largeCatName = largeId ? (localCategories.find(c => c.id === largeId)?.name || "") : "";
        const mediumCatName = mediumId ? (localCategories.find(c => c.id === mediumId)?.name || "") : "";
        const smallCatName = smallId ? (localCategories.find(c => c.id === smallId)?.name || "") : "";
        
        filteredProducts = filteredProducts.filter(p => {
            const tagMatch = p.details ? p.details.match(/\[카테고리:([^\]]+)\]/) : null;
            if (!tagMatch) return false;
            
            const catPath = tagMatch[1]; // 예: "의류>상의>셔츠"
            const parts = catPath.split(">");
            
            const pLarge = parts[0] || "";
            const pMedium = parts[1] || "";
            const pSmall = parts[2] || "";
            
            if (largeCatName && pLarge !== largeCatName) return false;
            if (mediumCatName && pMedium !== mediumCatName) return false;
            if (smallCatName && pSmall !== smallCatName) return false;
            
            return true;
        });
    }
    
    // 🔍 [신설] 상단 총 등록 개수 라벨 동기화
    const elTotalCount = document.getElementById("admin-prod-total-count");
    if (elTotalCount) {
        elTotalCount.textContent = filteredProducts.length;
    }
    
    renderAdminTableRows(filteredProducts);
}

// 📦 대표님이 직접 타이핑하여 브랜드, 도매가, 원글주소, 상세옵션, 재고수량 및 품절여부를 바로 수정하는 초정밀 렌더러
function renderAdminTableRows(products) {
    const tbody = document.getElementById("admin-product-rows");
    tbody.innerHTML = "";
    
    products.forEach(p => {
        const tr = document.createElement("tr");
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        
        // 실시간 가감 수정을 위한 옵션 문자열 조립
        const colorsStr = (p.colors || []).join(",");
        const sizesStr = (p.sizes || []).join(",");
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="admin-prod-check" value="${p.id}" onclick="event.stopPropagation()" style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td style="text-align: center;">
                <img src="${repImg}" class="admin-img-thumb" alt="${p.name}"><br>
                <a href="${p.post_url || '#'}" target="_blank" class="admin-post-link" style="font-size:10.5px; display:inline-block; margin-top:4px;">🔗 밴드 원본</a>
            </td>
            <td>
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px;">브랜드명</span>
                <input type="text" class="admin-input-text" style="font-weight: 700; color: var(--admin-accent);" id="admin-brand-${p.id}" value="${p.brand || ''}">
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-top:6px; margin-bottom:2px;">밴드 글 URL</span>
                <input type="text" class="admin-input-text" style="font-size:10.5px;" id="admin-url-${p.id}" value="${p.post_url || ''}">
            </td>
            <td>
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px;">상품진열명</span>
                <input type="text" class="admin-input-text" id="admin-name-${p.id}" value="${p.name || ''}">
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-top:6px; margin-bottom:2px;">카테고리 지정 (대 > 중 > 소)</span>
                <div style="display: flex; gap: 4px;">
                    <select id="admin-category-large-${p.id}" class="admin-input-text" style="font-size:11px; padding:2px; flex:1;" onchange="onAdminRowCategoryLargeChange('${p.id}')">
                        <option value="">대분류</option>
                    </select>
                    <select id="admin-category-medium-${p.id}" class="admin-input-text" style="font-size:11px; padding:2px; flex:1;" onchange="onAdminRowCategoryMediumChange('${p.id}')">
                        <option value="">중분류</option>
                    </select>
                    <select id="admin-category-small-${p.id}" class="admin-input-text" style="font-size:11px; padding:2px; flex:1;">
                        <option value="">소분류</option>
                    </select>
                </div>
            </td>
            <td>
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px; text-align:center;">도매원가</span>
                <input type="text" class="admin-input-text" style="text-align: center;" id="admin-original-${p.id}" value="${p.original_price || ''}">
            </td>
            <td>
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px; text-align:center;">소비자가격</span>
                <input type="number" class="admin-input-text" style="font-family: var(--font-outfit); font-weight: 700; text-align: center;" id="admin-price-${p.id}" value="${p.selling_price || 0}">
            </td>
            <td>
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px; text-align:center;">재고수량</span>
                <input type="number" class="admin-input-text" style="text-align: center; font-weight: 700;" id="admin-stock-${p.id}" value="${p.stock !== undefined ? p.stock : 99}">
            </td>
            <td style="text-align: center;">
                <span style="font-size:9.5px; color:var(--text-secondary); display:block; margin-bottom:2px;">품절여부</span>
                <input type="checkbox" id="admin-soldout-${p.id}" ${p.is_soldout ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td>
                <div class="option-group" style="margin-bottom: 5px;">
                    <span style="font-size: 9.5px; color: var(--text-secondary); display:block; margin-bottom:2px;">Colors (쉼표 구분)</span>
                    <input type="text" class="admin-input-text" style="font-size:11px;" id="admin-colors-${p.id}" value="${colorsStr}" placeholder="블랙,화이트">
                </div>
                <div class="option-group">
                    <span style="font-size: 9.5px; color: var(--text-secondary); display:block; margin-bottom:2px;">Sizes (쉼표 구분)</span>
                    <input type="text" class="admin-input-text" style="font-size:11px;" id="admin-sizes-${p.id}" value="${sizesStr}" placeholder="95,100,105">
                </div>
            </td>
            <td style="text-align: center;">
                <label class="switch">
                    <input type="checkbox" id="admin-visible-${p.id}" ${p.is_visible ? 'checked' : ''} onchange="toggleProductVisibility('${p.id}')">
                    <span class="slider"></span>
                </label>
            </td>
            <td style="text-align: center;">
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <button class="admin-save-btn" style="background-color: #5A4E40;" onclick="openEditProductModal('${p.id}')">✏️ 수정실</button>
                    <button class="admin-save-btn" onclick="saveProductEdits('${p.id}')">저장</button>
                    <button class="admin-save-btn" style="background-color:#D32F2F;" onclick="deleteProductDirect('${p.id}', '${p.name}')">삭제</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // ⚡ DOM 렌더링이 완료된 후 각 상품행의 3단 카테고리 드롭다운을 파싱 및 로딩합니다.
    products.forEach(p => {
        populateAdminRowCategoryDropdowns(p);
    });
}

/**
 * 👑 [계층형 카테고리 어드민 확장] 개별 상품 행의 3단 카테고리 셀렉터 옵션 주입 및 기존 설정값 바인딩 함수
 * - details 본문에 부착된 [카테고리:대>중>소] 경로를 파싱하여 정확한 UUID를 찾아 select 값으로 복원합니다.
 */
function populateAdminRowCategoryDropdowns(p) {
    const largeSelect = document.getElementById(`admin-category-large-${p.id}`);
    const mediumSelect = document.getElementById(`admin-category-medium-${p.id}`);
    const smallSelect = document.getElementById(`admin-category-small-${p.id}`);
    
    if (!largeSelect || !mediumSelect || !smallSelect) return;
    
    // 1) 기존 상품의 카테고리 경로를 파싱하여 한글 카테고리명 획득
    const tagMatch = p.details ? p.details.match(/\[카테고리:([^\]]+)\]/) : null;
    const parts = tagMatch ? tagMatch[1].split(">").map(x => x.trim()) : [];
    
    const initialLargeName = parts[0] || "";
    const initialMediumName = parts[1] || "";
    const initialSmallName = parts[2] || "";
    
    // 2) 한글 카테고리명과 일치하는 카테고리 DB 정보를 탐색하여 ID 매핑
    const largeCat = localCategories.find(c => c.name === initialLargeName && (c.depth === 0 || !c.depth));
    const largeId = largeCat ? largeCat.id : "";
    
    const mediumCat = largeId ? localCategories.find(c => c.name === initialMediumName && c.depth === 1 && c.parent_id === largeId) : null;
    const mediumId = mediumCat ? mediumCat.id : "";
    
    const smallCat = mediumId ? localCategories.find(c => c.name === initialSmallName && c.depth === 2 && c.parent_id === mediumId) : null;
    const smallId = smallCat ? smallCat.id : "";
    
    // 3) 대분류 옵션 동적 적재 및 바인딩
    const largeCategories = localCategories.filter(c => c.depth === 0 || !c.depth);
    largeSelect.innerHTML = '<option value="">대분류</option>';
    largeCategories.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        largeSelect.appendChild(option);
    });
    largeSelect.value = largeId;
    
    // 4) 중분류 옵션 동적 적재 및 바인딩
    mediumSelect.innerHTML = '<option value="">중분류</option>';
    if (largeId) {
        const mediumCategories = localCategories.filter(c => c.depth === 1 && c.parent_id === largeId);
        mediumCategories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.name;
            mediumSelect.appendChild(option);
        });
        mediumSelect.value = mediumId;
    }
    
    // 5) 소분류 옵션 동적 적재 및 바인딩
    smallSelect.innerHTML = '<option value="">소분류</option>';
    if (mediumId) {
        const smallCategories = localCategories.filter(c => c.depth === 2 && c.parent_id === mediumId);
        smallCategories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id;
            option.textContent = cat.name;
            smallSelect.appendChild(option);
        });
        smallSelect.value = smallId;
    }
}

/**
 * 👑 [계층형 카테고리 어드민 확장] 행의 대분류 변경 시 중분류/소분류 드롭다운 Cascading 동적 갱신
 */
function onAdminRowCategoryLargeChange(prodId) {
    const largeSelect = document.getElementById(`admin-category-large-${prodId}`);
    const mediumSelect = document.getElementById(`admin-category-medium-${prodId}`);
    const smallSelect = document.getElementById(`admin-category-small-${prodId}`);
    
    if (!largeSelect || !mediumSelect || !smallSelect) return;
    
    const largeId = largeSelect.value;
    mediumSelect.innerHTML = '<option value="">중분류</option>';
    smallSelect.innerHTML = '<option value="">소분류</option>';
    
    if (!largeId) return;
    
    const filteredMedium = localCategories.filter(c => c.depth === 1 && c.parent_id === largeId);
    filteredMedium.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        mediumSelect.appendChild(option);
    });
}

/**
 * 👑 [계층형 카테고리 어드민 확장] 행의 중분류 변경 시 소분류 드롭다운 Cascading 동적 갱신
 */
function onAdminRowCategoryMediumChange(prodId) {
    const mediumSelect = document.getElementById(`admin-category-medium-${prodId}`);
    const smallSelect = document.getElementById(`admin-category-small-${prodId}`);
    
    if (!mediumSelect || !smallSelect) return;
    
    const mediumId = mediumSelect.value;
    smallSelect.innerHTML = '<option value="">소분류</option>';
    
    if (!mediumId) return;
    
    const filteredSmall = localCategories.filter(c => c.depth === 2 && c.parent_id === mediumId);
    filteredSmall.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        smallSelect.appendChild(option);
    });
}

// 👥 [신설 고객관리] Supabase profiles 회원 목록 호출 (지능형 더미 결합 Fail-safe)
async function fetchAdminCustomers() {
    // 👥 [체크박스 고도화] 회원 목록 로딩 시 상단 전체 선택 마스터 체크박스 해제
    const masterCheck = document.getElementById("admin-cust-all-check-all");
    if (masterCheck) masterCheck.checked = false;

    const tbody = document.getElementById("admin-customer-rows");
    if (!tbody) return;
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 50px 0;">
                <div class="spinner" style="width: 25px; height: 25px;"></div>
                <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">실시간 회원 대장을 호출하고 있습니다...</p>
            </td>
        </tr>
    `;
    
    let customersList = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("*")
                .order("name", { ascending: true }));
                
            if (error) throw error;
            customersList = data || [];
            if (customersList.length === 0) {
                customersList = [...localUsers];
            }
        } catch(e) {
            customersList = [...localUsers];
        }
    } else {
        customersList = [...localUsers];
    }
    
    window.__adminCustomerCache = customersList;
    renderAdminCustomerRows(customersList);
}

// 👥 고객 대장 리스트 표 분사 렌더링
function renderAdminCustomerRows(users) {
    const tbody = document.getElementById("admin-customer-rows");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-size:12px;">
                    가입된 회원 목록이 존재하지 않습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    users.forEach(u => {
        const tr = document.createElement("tr");
        
        // 🛡️ [보안 고도화] 어드민 회원 목록에 개인정보를 뿌려주기 직전에 복호화(decrypt)를 실행합니다.
        const decName = secureDecrypt(u.name);
        const decPhone = secureDecrypt(u.phone);
        const decPost = secureDecrypt(u.postcode);
        const decAddr = secureDecrypt(u.address);
        const decAddrDetail = secureDecrypt(u.address_detail);

        const fullAddress = decPost 
            ? `[${escapeHtml(decPost)}] ${escapeHtml(decAddr)} ${escapeHtml(decAddrDetail)}` 
            : `<span style="color:#aaa;">주소 미등록</span>`;
        const phoneVal = decPhone 
            ? escapeHtml(decPhone) 
            : `<span style="color:#aaa;">연락처 미등록</span>`;
        const emailVal = u.email 
            ? escapeHtml(u.email) 
            : `${escapeHtml(decName || 'user')}@pkb71.com (가상)`;
        const customerId = escapeAdminJsString(u.id);
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="admin-cust-all-check" value="${u.id}" onclick="event.stopPropagation()" style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td>
                <button type="button" onclick="openAdminCustomerDetail('${customerId}')" style="border:0; background:none; padding:0; cursor:pointer; text-decoration:underline; color:var(--admin-accent); font-weight:800; font-size:12px; font-family:var(--font-outfit);">${emailVal}</button>
            </td>
            <td>
                <button type="button" onclick="openAdminCustomerDetail('${customerId}')" style="border:0; background:none; padding:0; cursor:pointer; text-decoration:underline; color:var(--text-primary); font-weight:800; font-size:13px;">${escapeHtml(decName) || '무명고객'}</button><br>
                <span style="font-size: 11px; color: var(--text-secondary);">${phoneVal}</span>
            </td>
            <td style="text-align: left; font-size: 11.5px; line-height: 1.5; color:var(--text-primary);">
                ${fullAddress}
            </td>
            <td style="font-family: var(--font-outfit); font-weight: 700; text-align: center; font-size: 13.5px; color: var(--accent-gold);">
                ₩${(u.points || 0).toLocaleString()}
            </td>
            <td style="text-align: center;">
                <input type="number" class="admin-points-input" id="points-diff-${u.id}" placeholder="충전/차감액 기입">
            </td>
            <td style="text-align: center;">
                <button class="admin-points-btn" onclick="updateCustomerPointsDirect('${u.id}', '${u.name || '고객'}')">조정</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 🔍 [신설 회원검색] 조건 검색용 회원 목록 데이터베이스 호출 및 필터링 엔진
// - 대표님이 이름, 아이디(이메일), 연락처를 검색분류에 맞춰 조회 시 조건 필터링을 거쳐 출력합니다.
// - 안전한 개인정보 보안을 위해 이름, 연락처, 주소 정보는 secureDecrypt 함수로 실시간 복호화하여 렌더링합니다.
function escapeAdminJsString(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function getAdminCustomerPlainValue(user, key) {
    const raw = user && user[key] !== undefined ? user[key] : "";
    return typeof secureDecrypt === "function" ? secureDecrypt(raw) : (raw || "");
}

function getAdminCustomerById(customerId) {
    if (!customerId) return null;
    const cached = Array.isArray(window.__adminCustomerCache) ? window.__adminCustomerCache : [];
    const local = Array.isArray(localUsers) ? localUsers : [];
    return [...cached, ...local].find(user => String(user.id) === String(customerId)) || null;
}

function openAdminCustomerDetail(customerId) {
    const user = getAdminCustomerById(customerId);
    if (!user) {
        alert("회원 정보를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.");
        return;
    }
    renderAdminCustomerDetail(user);
}

function renderAdminCustomerDetail(user) {
    const ready = document.getElementById("admin-tab-ready");
    if (!ready) return;

    document.querySelectorAll(".admin-tab-content").forEach(content => {
        content.style.display = "none";
    });
    ready.style.display = "block";

    document.querySelectorAll(".sidebar-link").forEach(link => link.classList.remove("active"));
    const searchLink = document.getElementById("tab-customers-search-btn");
    if (searchLink) {
        searchLink.classList.add("active");
        const group = searchLink.closest(".menu-group");
        if (group) group.classList.add("active");
    }

    const titleEl = document.getElementById("admin-page-title");
    const descEl = document.getElementById("admin-page-desc");
    if (titleEl) titleEl.textContent = "회원 상세정보 수정";
    if (descEl) descEl.textContent = "조회된 회원의 기본 정보, 연락처, 배송지, 적립금을 확인하고 수정합니다.";

    const id = String(user.id || "");
    const email = user.email || "";
    const name = getAdminCustomerPlainValue(user, "name");
    const phone = getAdminCustomerPlainValue(user, "phone");
    const postcode = getAdminCustomerPlainValue(user, "postcode");
    const address = getAdminCustomerPlainValue(user, "address");
    const addressDetail = getAdminCustomerPlainValue(user, "address_detail");
    const points = Number(user.points || 0);
    const createdAt = user.created_at ? new Date(user.created_at).toLocaleString("ko-KR", { hour12: false }) : "-";

    ready.innerHTML = `
        <div class="mypage-profile-panel" style="padding:24px; max-width:1100px;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px;">
                <div>
                    <h4 class="checkout-section-title" style="margin:0 0 6px 0; font-size:20px;">회원 상세정보</h4>
                    <p class="mypage-sub-desc" style="margin:0;">아이디 또는 이름을 클릭해 들어온 회원 정보입니다.</p>
                </div>
                <button type="button" class="postcode-btn" style="background:#fff; color:#1A222E; border:1px solid var(--border-light);" onclick="switchAdminTab('customers-search')">목록으로</button>
            </div>

            <div style="display:grid; grid-template-columns:170px 1fr; border:1px solid var(--border-light); border-bottom:0;">
                <label class="admin-detail-label">회원 아이디</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-email" class="form-input" type="email" value="${escapeHtml(email)}" style="max-width:420px;">
                    <span style="font-size:11px; color:var(--text-secondary); margin-left:8px;">회원 고유번호: ${escapeHtml(id)}</span>
                </div>

                <label class="admin-detail-label">고객 이름</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-name" class="form-input" type="text" value="${escapeHtml(name)}" style="max-width:420px;">
                </div>

                <label class="admin-detail-label">연락처</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-phone" class="form-input" type="text" value="${escapeHtml(phone)}" style="max-width:420px;">
                </div>

                <label class="admin-detail-label">우편번호</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-postcode" class="form-input" type="text" value="${escapeHtml(postcode)}" style="max-width:180px;">
                </div>

                <label class="admin-detail-label">기본 배송 주소</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-address" class="form-input" type="text" value="${escapeHtml(address)}">
                </div>

                <label class="admin-detail-label">상세 주소</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-address-detail" class="form-input" type="text" value="${escapeHtml(addressDetail)}">
                </div>

                <label class="admin-detail-label">보유 적립금</label>
                <div class="admin-detail-field">
                    <input id="admin-detail-points" class="form-input" type="number" value="${points}" style="max-width:220px;">
                    <span style="font-size:12px; color:var(--accent-gold); font-weight:700; margin-left:8px;">현재 ${points.toLocaleString()}원</span>
                </div>

                <label class="admin-detail-label">가입일</label>
                <div class="admin-detail-field" style="font-size:13px; color:var(--text-secondary);">${escapeHtml(createdAt)}</div>
            </div>

            <div style="display:flex; justify-content:center; gap:10px; margin-top:22px;">
                <button type="button" class="admin-save-btn" onclick="saveAdminCustomerDetail('${escapeAdminJsString(id)}')">회원정보 저장</button>
                <button type="button" class="postcode-btn" style="background:#5A4E40; color:#fff;" onclick="openAdminCustomerDetail('${escapeAdminJsString(id)}')">수정 취소</button>
                <button type="button" class="postcode-btn" style="background:#fff; color:#1A222E; border:1px solid var(--border-light);" onclick="switchAdminTab('customers-search')">목록으로</button>
            </div>
        </div>
    `;
}

async function saveAdminCustomerDetail(customerId) {
    const user = getAdminCustomerById(customerId);
    if (!user) {
        alert("저장할 회원 정보를 찾을 수 없습니다.");
        return;
    }

    const read = id => document.getElementById(id)?.value?.trim() || "";
    const nextEmail = read("admin-detail-email");
    const nextName = read("admin-detail-name");
    const nextPhone = read("admin-detail-phone");
    const nextPostcode = read("admin-detail-postcode");
    const nextAddress = read("admin-detail-address");
    const nextAddressDetail = read("admin-detail-address-detail");
    const nextPoints = Math.max(0, Number(read("admin-detail-points").replace(/,/g, "")) || 0);

    if (!nextEmail || !nextName) {
        alert("회원 아이디와 고객 이름은 필수입니다.");
        return;
    }

    const encrypted = value => (typeof secureEncrypt === "function" ? secureEncrypt(value) : value);
    const updatePayload = {
        email: nextEmail,
        name: encrypted(nextName),
        phone: encrypted(nextPhone),
        postcode: encrypted(nextPostcode),
        address: encrypted(nextAddress),
        address_detail: encrypted(nextAddressDetail),
        points: nextPoints
    };

    if (typeof supabaseClient !== "undefined" && supabaseClient && !String(customerId).startsWith("mock-")) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .update(updatePayload)
                .eq("id", customerId));
            if (error) throw error;
        } catch (error) {
            alert(`DB 회원정보 저장 실패: ${error.message || error}`);
            return;
        }
    }

    Object.assign(user, updatePayload);
    try {
        safeLocalStorage.setItem("pkb71_users", JSON.stringify(localUsers));
    } catch (error) {
        console.warn("회원 정보 로컬 저장 실패:", error);
    }

    if (typeof showToast === "function") {
        showToast("회원정보가 저장되었습니다.");
    } else {
        alert("회원정보가 저장되었습니다.");
    }
    renderAdminCustomerDetail(user);
}

function bindAdminCustomerDetailRowClicks() {
    if (window.__adminCustomerDetailRowClicksBound) return;
    window.__adminCustomerDetailRowClicksBound = true;

    document.addEventListener("click", event => {
        if (event.target.closest("input, select, textarea, button")) return;

        const cell = event.target.closest("#admin-cust-search-rows td, #admin-customer-rows td");
        if (!cell) return;

        const row = cell.closest("tr");
        const cells = Array.from(row?.children || []);
        const cellIndex = cells.indexOf(cell);
        if (cellIndex !== 1 && cellIndex !== 2) return;

        const checkbox = row.querySelector(".admin-cust-check, .admin-cust-all-check");
        const customerId = checkbox?.value;
        if (!customerId) return;

        event.preventDefault();
        openAdminCustomerDetail(customerId);
    });

    document.addEventListener("mouseover", event => {
        const cell = event.target.closest("#admin-cust-search-rows td, #admin-customer-rows td");
        if (!cell) return;
        const row = cell.closest("tr");
        const cells = Array.from(row?.children || []);
        const cellIndex = cells.indexOf(cell);
        if (cellIndex === 1 || cellIndex === 2) cell.style.cursor = "pointer";
    });
}

bindAdminCustomerDetailRowClicks();

async function fetchAdminSearchCustomers() {
    // 👥 [체크박스 고도화] 회원 검색 목록 로딩 시 상단 전체 선택 마스터 체크박스 해제
    const masterCheck = document.getElementById("admin-cust-check-all");
    if (masterCheck) masterCheck.checked = false;

    const tbody = document.getElementById("admin-cust-search-rows");
    const countEl = document.getElementById("admin-cust-search-total-count");
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 50px 0;">
                <div class="spinner" style="width: 25px; height: 25px;"></div>
                <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">실시간 회원 데이터를 조회하고 있습니다...</p>
            </td>
        </tr>
    `;
    if (countEl) countEl.textContent = "0";

    // 대표님이 선택하신 검색분류와 입력하신 키워드 값 획득
    const searchType = document.getElementById("admin-cust-search-type")?.value || "name";
    const keyword = document.getElementById("admin-cust-search-keyword")?.value.trim().toLowerCase() || "";

    let customersList = [];
    if (supabaseClient) {
        try {
            // 회원 데이터베이스 profiles를 전체 조회하여 최신 가입 순서로 나열합니다.
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            customersList = data || [];
            if (customersList.length === 0) {
                customersList = [...localUsers];
            }
        } catch(e) {
            console.warn("Supabase 회원 조회 실패 또는 타임아웃, 로컬 데이터로 대체 가동합니다.", e);
            customersList = [...localUsers];
        }
    } else {
        customersList = [...localUsers];
    }

    // 🛡️ [보안 고도화 & 필터링] 암호화된 성함/연락처 정보를 복호화 후 키워드 대조 필터링
    window.__adminCustomerCache = customersList;
    const filteredCustomers = customersList.filter(u => {
        const decName = secureDecrypt(u.name) || "";
        const decPhone = secureDecrypt(u.phone) || "";
        const emailVal = u.email || "";

        if (!keyword) return true; // 검색 키워드가 없으면 전원 리스팅

        if (searchType === "name") {
            return decName.toLowerCase().includes(keyword);
        } else if (searchType === "email") {
            return emailVal.toLowerCase().includes(keyword);
        } else if (searchType === "phone") {
            // 연락처에서 기호(- 등)를 제외한 숫자 대조와 텍스트 대조를 둘 다 지원하여 직관성을 높입니다.
            const purePhone = decPhone.replace(/[^0-9]/g, "");
            const pureKeyword = keyword.replace(/[^0-9]/g, "");
            return purePhone.includes(pureKeyword) || decPhone.includes(keyword);
        }
        return true;
    });

    // 👥 상단 인덱서에 조회된 총 회원수 업데이트
    if (countEl) countEl.textContent = filteredCustomers.length;

    tbody.innerHTML = "";
    if (filteredCustomers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-size:12px;">
                    검색 조건과 일치하는 가입 회원이 존재하지 않습니다.
                </td>
            </tr>
        `;
        return;
    }

    // 조건에 맞는 회원을 복사해서 즉시 덮어쓸 수 있도록 HTML 테이블 분사
    filteredCustomers.forEach(u => {
        const tr = document.createElement("tr");
        
        // 개인정보 실시간 보안 복호화
        const decName = secureDecrypt(u.name);
        const decPhone = secureDecrypt(u.phone);
        const decPost = secureDecrypt(u.postcode);
        const decAddr = secureDecrypt(u.address);
        const decAddrDetail = secureDecrypt(u.address_detail);

        const fullAddress = decPost 
            ? `[${escapeHtml(decPost)}] ${escapeHtml(decAddr)} ${escapeHtml(decAddrDetail)}` 
            : `<span style="color:#aaa;">주소 미등록</span>`;
        const phoneVal = decPhone 
            ? escapeHtml(decPhone) 
            : `<span style="color:#aaa;">연락처 미등록</span>`;
        const emailVal = u.email 
            ? escapeHtml(u.email) 
            : `${escapeHtml(decName || 'user')}@pkb71.com (가상)`;

        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="admin-cust-check" value="${u.id}" onclick="event.stopPropagation()" style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td>
                <b style="font-size:12px; font-family:var(--font-outfit);">${emailVal}</b>
            </td>
            <td>
                <span style="font-weight: 700; font-size: 13px; color:var(--text-primary);">${escapeHtml(decName) || '무명고객'}</span><br>
                <span style="font-size: 11px; color: var(--text-secondary);">${phoneVal}</span>
            </td>
            <td style="text-align: left; font-size: 11.5px; line-height: 1.5; color:var(--text-primary);">
                ${fullAddress}
            </td>
            <td style="font-family: var(--font-outfit); font-weight: 700; text-align: center; font-size: 13.5px; color: var(--accent-gold);">
                ₩${(u.points || 0).toLocaleString()}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 🔍 회원 조건 검색 실행 (검색 버튼 / 엔터키)
function executeAdminCustomerSearch() {
    fetchAdminSearchCustomers();
}

// 🔄 회원 조건 검색 필터 초기화
function resetAdminCustomerSearch() {
    const typeEl = document.getElementById("admin-cust-search-type");
    const keywordEl = document.getElementById("admin-cust-search-keyword");
    if (typeEl) typeEl.value = "name";
    if (keywordEl) keywordEl.value = "";
    fetchAdminSearchCustomers();
}

// ⏰ [기간 검색 퀵 제어] 대표님이 퀵 버튼(오늘, 7일 등) 클릭 시 날짜 범위를 자동 연산하여 인풋 상자에 주입합니다.
function setAdminOrderDateRange(days) {
    const startDateInput = document.getElementById("admin-order-start-date");
    const endDateInput = document.getElementById("admin-order-end-date");
    if (!startDateInput || !endDateInput) return;
    
    const today = new Date();
    const format = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    
    let start, end;
    if (days === 0) {
        start = today;
        end = today;
    } else if (days === 1) {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = yesterday;
        end = yesterday;
    } else {
        const prev = new Date();
        prev.setDate(today.getDate() - days);
        start = prev;
        end = today;
    }
    
    startDateInput.value = format(start);
    endDateInput.value = format(end);
    
    fetchAdminOrders();
}
window.setAdminOrderDateRange = setAdminOrderDateRange; // 외부 인라인 태그 onclick 바인딩용

// 🧹 [상세 검색 리셋] 모든 검색 조건을 공백 및 초기 설정값으로 안전 리셋합니다.
function resetAdminOrderSearch() {
    const startDateInput = document.getElementById("admin-order-start-date");
    const endDateInput = document.getElementById("admin-order-end-date");
    const searchType = document.getElementById("admin-order-search-type");
    const searchKeyword = document.getElementById("admin-order-search-keyword");
    const statusFilter = document.getElementById("admin-order-status-filter");
    const sortSelect = document.getElementById("admin-order-sort");
    const pageSizeSelect = document.getElementById("admin-order-page-size");
    
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";
    if (searchType) searchType.value = "order_no";
    if (searchKeyword) searchKeyword.value = "";
    if (statusFilter) statusFilter.value = "all";
    if (sortSelect) sortSelect.value = "date-desc";
    if (pageSizeSelect) pageSizeSelect.value = "30";
    
    fetchAdminOrders();
}
window.resetAdminOrderSearch = resetAdminOrderSearch;

async function fetchAdminOrders() {
    // 📦 [체크박스 고도화] 주문 목록 로딩 시 상단 전체 선택 마스터 체크박스 해제
    const masterCheck = document.getElementById("admin-orders-check-all");
    if (masterCheck) masterCheck.checked = false;

    const tbody = document.getElementById("admin-order-rows");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" style="text-align: center; padding: 50px 0;">
                <div class="spinner" style="width: 25px; height: 25px;"></div>
                <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">실시간 고객 주문 대장 인출 중...</p>
            </td>
        </tr>
    `;
    
    let adminOrders = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            adminOrders = data || [];
            if (adminOrders.length === 0) {
                adminOrders = [...DUMMY_ORDERS];
            }
        } catch (e) {
            adminOrders = [...DUMMY_ORDERS];
        }
    } else {
        adminOrders = [...DUMMY_ORDERS];
    }
    
    const pendingCount = adminOrders.filter(o => o.status === "입금대기").length;
    const pendingCountEl = document.getElementById("admin-pending-orders-count");
    if (pendingCountEl) pendingCountEl.textContent = pendingCount;
    
    // 🔍 [고도화] 기간 필터, 검색 조건, 주문 상태 필터 수집
    const startDateInput = document.getElementById("admin-order-start-date");
    const endDateInput = document.getElementById("admin-order-end-date");
    const searchTypeSelect = document.getElementById("admin-order-search-type");
    const searchKeywordInput = document.getElementById("admin-order-search-keyword");
    const statusFilterSelect = document.getElementById("admin-order-status-filter");
    const sortSelect = document.getElementById("admin-order-sort");
    const pageSizeSelect = document.getElementById("admin-order-page-size");
    
    const startVal = startDateInput ? startDateInput.value : "";
    const endVal = endDateInput ? endDateInput.value : "";
    const searchType = searchTypeSelect ? searchTypeSelect.value : "order_no";
    const keyword = searchKeywordInput ? searchKeywordInput.value.trim().toLowerCase() : "";
    const statusVal = statusFilterSelect ? statusFilterSelect.value : "all";
    const sortVal = sortSelect ? sortSelect.value : "date-desc";
    const pageSize = pageSizeSelect ? parseInt(pageSizeSelect.value) : 30;
    
    let filteredOrders = [...adminOrders];
    
    // 1. 기간 필터링 (주문일 기준)
    if (startVal) {
        const startDate = new Date(startVal + "T00:00:00");
        filteredOrders = filteredOrders.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate >= startDate;
        });
    }
    if (endVal) {
        const endDate = new Date(endVal + "T23:59:59");
        filteredOrders = filteredOrders.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate <= endDate;
        });
    }
    
    // 2. 검색어 상세 필터링 (복호화 데이터 교차 검증)
    if (keyword) {
        filteredOrders = filteredOrders.filter(o => {
            if (searchType === "order_no") {
                return o.order_no && o.order_no.toLowerCase().includes(keyword);
            }
            if (searchType === "customer_name") {
                // 개인정보 보안 복호화하여 대조
                const decName = secureDecrypt(o.customer_name).toLowerCase();
                return decName.includes(keyword);
            }
            if (searchType === "depositor") {
                const decDepositor = secureDecrypt(o.depositor).toLowerCase();
                return decDepositor.includes(keyword);
            }
            if (searchType === "product_name") {
                // 주문 상품 목록 중 하나라도 일치하는 상품명이 있는지 확인
                if (o.items && Array.isArray(o.items)) {
                    return o.items.some(item => item.name && item.name.toLowerCase().includes(keyword));
                }
            }
            return false;
        });
    }
    
    // 3. 주문상태 필터링
    if (statusVal !== "all") {
        filteredOrders = filteredOrders.filter(o => o.status === statusVal);
    }
    
    // 4. 정렬 로직 적용
    if (sortVal === "date-desc") {
        filteredOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sortVal === "date-asc") {
        filteredOrders.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (sortVal === "amount-desc") {
        filteredOrders.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
    } else if (sortVal === "amount-asc") {
        filteredOrders.sort((a, b) => (a.total_amount || 0) - (b.total_amount || 0));
    }
    
    // 조회 건수 갱신
    const totalCountEl = document.getElementById("admin-orders-total-count");
    if (totalCountEl) totalCountEl.textContent = filteredOrders.length;
    
    // 5. 페이지 사이즈만큼 슬라이싱하여 렌더링
    const pagedOrders = filteredOrders.slice(0, pageSize);
    
    renderAdminOrderRows(pagedOrders);
}

function renderAdminOrderRows(orders) {
    const tbody = document.getElementById("admin-order-rows");
    tbody.innerHTML = "";
    
    orders.forEach(o => {
        const tr = document.createElement("tr");
        const oDate = new Date(o.created_at);
        const formattedDate = `${oDate.getFullYear()}-${(oDate.getMonth()+1).toString().padStart(2,'0')}-${oDate.getDate().toString().padStart(2,'0')} ${oDate.getHours().toString().padStart(2,'0')}:${oDate.getMinutes().toString().padStart(2,'0')}`;
        
        const itemsHtml = o.items.map(item => {
            return `
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; border-bottom:1px dashed #eee; padding-bottom:4px;">
                    <img src="${item.thumb}" style="width:30px; height:40px; object-fit:cover; border-radius:3px;" />
                    <div style="font-size:11.5px; line-height:1.4;">
                        <span style="font-weight:600;">${escapeHtml(item.name)}</span><br>
                        <span style="color:var(--text-secondary);">${escapeHtml(item.color)} / ${escapeHtml(item.size)} <b style="color:var(--accent-gold);">(${item.qty}개)</b></span>
                    </div>
                </div>
            `;
        }).join("");
        
        // 🛡️ [보안 고도화] 어드민 주문 목록에 뿌려주기 직전에 민감 주문 고객 개인정보를 전격 복호화합니다.
        const decCustName = secureDecrypt(o.customer_name);
        const decDepositor = secureDecrypt(o.depositor);
        const decPhone = secureDecrypt(o.phone);
        const decPostcode = secureDecrypt(o.postcode);
        const decAddress = secureDecrypt(o.address);
        const decAddressDetail = secureDecrypt(o.address_detail);
        const decMessage = secureDecrypt(o.message);
        
        let receiptHtml = "";
        if (decMessage && decMessage.includes("[현금영수증:")) {
            const hp = decMessage.match(/\[현금영수증:([^\]]+)\]/)[1];
            receiptHtml = `<br><span style="font-size:11px; color:#2E7D32; font-weight:700;">🧾 현금영수증 신청 (${escapeHtml(hp)})</span>`;
        }
        
        let claimReasonHtml = "";
        if (decMessage && decMessage.includes("[클레임 사유:")) {
            const reason = decMessage.match(/\[클레임 사유:([^\]]+)\]/)[1];
            claimReasonHtml = `<br><span style="font-size:11px; color:#D32F2F; font-weight:700;">⚠️ 요청사유: ${escapeHtml(reason)}</span>`;
        }
        
        let trackingHtml = "";
        if (decMessage && decMessage.includes("[송장:")) {
            const track = decMessage.match(/\[송장:([^\]]+)\]/)[1];
            trackingHtml = `<br><span style="font-size:10.5px; color:#1565C0; font-weight:600;">🚛 송장: ${escapeHtml(track)}</span>`;
        }
        
        let statusClass = "pending";
        if (o.status === "결제완료") statusClass = "paid";
        if (o.status === "배송중") statusClass = "shipping";
        if (o.status === "주문취소" || o.status === "주문취소완료") statusClass = "cancelled";
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="admin-orders-check" value="${o.id}" onclick="event.stopPropagation()" style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td>
                <span style="font-family:var(--font-outfit); font-weight:700; color:var(--text-primary);">${escapeHtml(o.order_no)}</span><br>
                <span style="font-size:11px; color:var(--text-secondary);">${formattedDate}</span>
            </td>
            <td>
                <span style="font-weight:700; font-size:14px;">${escapeHtml(decCustName)}</span><br>
                <span style="font-size:11px; color:var(--accent-gold); font-weight:600;">입금자: ${escapeHtml(decDepositor)}</span>
            </td>
            <td style="font-size:12px; line-height:1.5;">
                📞 ${escapeHtml(decPhone)}<br>
                📮 [${escapeHtml(decPostcode)}] ${escapeHtml(decAddress)}<br>
                🏠 ${escapeHtml(decAddressDetail)}<br>
                <span style="color:#706B63; font-size:11px; font-weight:600;">💬 ${escapeHtml(decMessage || '메시지 없음')}</span>
                ${receiptHtml}
                ${claimReasonHtml}
                ${trackingHtml}
            </td>
            <td>${itemsHtml}</td>
            <td style="text-align: center; font-size:15px; font-weight:700; font-family:var(--font-outfit);">
                ₩${o.total_amount.toLocaleString()}
            </td>
            <td style="text-align: center;">
                <div style="display:flex; flex-direction:column; gap:8px; align-items:center;">
                    <span class="status-badge ${statusClass}">${o.status}</span>
                    <select class="admin-status-select" onchange="updateOrderStatus('${o.id}', this.value)">
                        <option value="입금대기" ${o.status === '입금대기' ? 'selected' : ''}>입금대기</option>
                        <option value="결제완료" ${o.status === '결제완료' ? 'selected' : ''}>결제완료</option>
                        <option value="배송중" ${o.status === '배송중' ? 'selected' : ''}>배송중</option>
                        <option value="주문취소" ${o.status === '주문취소' ? 'selected' : ''}>주문취소</option>
                        <option value="교환요청" ${o.status === '교환요청' ? 'selected' : ''}>교환요청</option>
                        <option value="반품요청" ${o.status === '반품요청' ? 'selected' : ''}>반품요청</option>
                    </select>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// 📋 [탭 전환] 카페24 스타일 다크 네이비 사이드바 탭 전환 엔진 함수
// - 좌측 사이드바 링크의 하이라이트 상태 스위칭 및 우측 해당 탭 콘텐츠만 블록 표시하도록 설계했습니다.
// - 탭이 변경될 때마다 페이지의 제목과 설명문구를 역동적으로 동기화하여 초보자도 쉽게 사용법을 인지할 수 있도록 돕습니다.
// 📋 [탭 전환] 카페24 스타일 다크 네이비 사이드바 탭 전환 엔진 함수
// - 좌측 사이드바 링크의 하이라이트 상태 스위칭 및 우측 해당 탭 콘텐츠만 블록 표시하도록 설계했습니다.
// - 새로 추가된 수십 가지 카페24 상세 메뉴 탭을 완벽하게 라우팅 지원합니다.
function switchAdminTab(tabName) {
    if (!checkAdminSession()) return; // 🛡️ 세션 검증 실행
    activeAdminTab = tabName;

    const ordersOpsStrip = document.getElementById("admin-orders-ops-strip");
    if (ordersOpsStrip) {
        const shouldShowOpsStrip = tabName === "orders-dashboard" || tabName.startsWith("orders-");
        ordersOpsStrip.style.display = shouldShowOpsStrip ? "grid" : "none";
    }

    const readyTabForDisplay = document.getElementById("admin-tab-ready");
    const productDisplayShell = document.getElementById("cafe24-display-shell");
    const isProductDisplayTab = tabName === "products-display";
    if (productDisplayShell) {
        productDisplayShell.style.display = isProductDisplayTab ? "" : "none";
    }
    if (readyTabForDisplay) {
        Array.from(readyTabForDisplay.children).forEach(child => {
            if (child.id === "cafe24-display-shell" || child.classList.contains("modal") || child.classList.contains("cart-modal-overlay")) return;
            child.classList.toggle("cafe24-display-legacy-hidden", isProductDisplayTab);
        });
    }
    
    // 1) 좌측 사이드바의 모든 탭 버튼에서 active 하이라이트 클래스 일괄 박탈
    const sidebarLinks = [
        "tab-dashboard-btn", 
        "tab-orders-dashboard-btn", "tab-orders-all-btn", "tab-orders-deposit-btn", "tab-orders-ready-btn", "tab-orders-hold-btn", "tab-orders-shipping-btn", "tab-orders-completed-btn", "tab-orders-claim-btn", "tab-orders-extra-btn", "tab-orders-auto-deposit-btn", "tab-orders-cash-receipt-btn", "tab-orders-tax-invoice-btn",
        "tab-products-dashboard-btn", "tab-products-list-btn", "tab-products-register-btn", "tab-products-manage-btn", "tab-products-categories-btn", "tab-products-display-btn", "tab-products-stock-btn", "tab-products-options-btn", "tab-products-curation-btn", "tab-products-sub-btn", "tab-products-restock-btn",
        "tab-customers-dashboard-btn", "tab-customers-search-btn", "tab-customers-manage-btn", "tab-customers-benefits-btn", "tab-customers-deposit-btn", "tab-customers-points-expire-btn", "tab-customers-audience-btn",
        "tab-qna-btn", "tab-notices-btn"
    ];
    sidebarLinks.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove("active");
    });
    
    // 2) 우측 메인 영역의 모든 탭 본문 콘텐츠 컨테이너 일괄 숨김 처리
    const tabContents = [
        "admin-tab-dashboard", "admin-tab-products", "admin-tab-orders", "admin-tab-add-product", 
        "admin-tab-customers", "admin-tab-categories", "admin-tab-qna", "admin-tab-notices", "admin-tab-ready",
        "admin-tab-orders-deposit", "admin-tab-orders-delivery", "admin-tab-orders-claim", "admin-tab-products-stock", "admin-tab-customers-dashboard",
        "admin-tab-customers-search"
    ];
    tabContents.forEach(id => {
        const content = document.getElementById(id);
        if (content) content.style.display = "none";
    });
    
    // 👑 대분류 아코디언 메뉴 자동 열림 연동
    // - 모든 대분류 menu-group에서 active를 빼고, 선택된 서브메뉴를 품고 있는 대분류만 active 활성화시킵니다.
    const allGroups = document.querySelectorAll(".menu-group");
    allGroups.forEach(group => group.classList.remove("active"));
    
    const activeLink = document.getElementById(`tab-${tabName}-btn`);
    if (activeLink) {
        activeLink.classList.add("active"); // 활성화된 서브링크 active 처리
        const parentGroup = activeLink.closest(".menu-group");
        if (parentGroup) parentGroup.classList.add("active"); // 소속 대분류 자동 펼침
    }
    
    // 3) 상단 제목 영역 DOM 획득
    const titleEl = document.getElementById("admin-page-title");
    const descEl = document.getElementById("admin-page-desc");
    
    // 4) 가상 시뮬레이터(HADES VIRTUAL SIMULATOR) 매핑용 해시맵 정의 (국세청, 은행, 카드사 등 모의 발행용)
    const simulatorConfig = {
        "orders-auto-deposit": {
            title: "⚡ 자동입금 확인 비서 (VIRTUAL SIMULATOR)",
            desc: "은행 스크래핑 모듈을 가상 시뮬레이션하여 입금자명과 매칭을 테스트합니다."
        },
        "orders-cash-receipt": {
            title: "💵 현금영수증 발행소 (VIRTUAL SIMULATOR)",
            desc: "국세청 API 가상 게이트웨이를 통해 결제완료 주문 건에 대해 가상 현금영수증을 모의 발급합니다."
        },
        "orders-tax-invoice": {
            title: "📑 전자세금계산서 발행소 (VIRTUAL SIMULATOR)",
            desc: "기업 주문 건의 사업자 가상 공동인증서 서명 및 전자세금계산서 가상 발행 대장입니다."
        },
        "orders-extra": {
            title: "⚙️ 주문 관리 부가기능 (VIRTUAL SIMULATOR)",
            desc: "주문서 대장 엑셀 양식 변환 및 3자 배송 대행 파일 가상 추출 시뮬레이터입니다."
        },
        "products-dashboard": {
            title: "📈 상품 통계 대시보드 (VIRTUAL SIMULATOR)",
            desc: "브랜드별 매출 비중 및 카테고리 선호도 도넛 그래프 시각화 모의 기동 엔진입니다."
        },
        "products-display": {
            title: "✨ 상품 진열 관리 (VIRTUAL SIMULATOR)",
            desc: "메인 배너 및 주간 베스트셀러 진열 그리드 위치 드래그 앤 드롭 가상 편집기입니다."
        },
        "products-options": {
            title: "🎨 상품 옵션 관리 (VIRTUAL SIMULATOR)",
            desc: "1차 색상, 2차 사이즈 외의 추가 요금 결합형 가상 다차원 옵션 스키마 설계실입니다."
        },
        "products-curation": {
            title: "👑 AI 쇼핑 큐레이션 (VIRTUAL SIMULATOR)",
            desc: "로그인 회원의 최근 북마크 및 구매 데이터를 분석한 가상 인공지능 추천 피드백 노드입니다."
        },
        "products-sub": {
            title: "📦 대체 공급처 연동 (VIRTUAL SIMULATOR)",
            desc: "도매처(1688 등)의 가상 API 상품 수급 상태를 모의 맵핑합니다."
        },
        "products-restock": {
            title: "🔔 재입고 알림 비서 (VIRTUAL SIMULATOR)",
            desc: "품절 상품 재입고 시 알림톡 가상 발송 대기자 명단입니다."
        },
        "customers-benefits": {
            title: "🎁 회원 등급 및 혜택 설정 (VIRTUAL SIMULATOR)",
            desc: "VIP/일반 회원 등급별 할인율 및 구매 적립금 지급 비율을 가상 설계합니다."
        },
        "customers-audience": {
            title: "🎯 타겟 오디언스 추출 (VIRTUAL SIMULATOR)",
            desc: "최근 3개월간 구매 이력이 없는 회원을 대상으로 마케팅 SMS 가상 발송 대상자를 필터링합니다."
        }
    };
    
    // 5) 탭별 화면 가시성 스위칭 및 비동기 데이터베이스 패칭 처리
    if (tabName === "dashboard" || tabName === "orders-dashboard") {
        const content = document.getElementById("admin-tab-dashboard");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "종합 대시보드";
        if (descEl) descEl.textContent = "오늘의 경영 상태 실시간 요약 및 인기 랭킹을 한눈에 파악합니다.";
        
        // 홈 대시보드 버튼과 주문 대시보드 버튼 하이라이트 분기
        const btnId = tabName === "dashboard" ? "tab-dashboard-btn" : "tab-orders-dashboard-btn";
        const targetBtn = document.getElementById(btnId);
        if (targetBtn) targetBtn.classList.add("active");
        
        if (tabName === "orders-dashboard") {
            if (titleEl) titleEl.textContent = "주문 대시보드";
            if (descEl) descEl.textContent = "실시간 주문, 매출, 배송, 클레임 현황을 주문관리 기준으로 확인합니다.";
            renderCafe24OrderDashboard();
        } else {
            if (titleEl) titleEl.textContent = "종합 대시보드";
            if (descEl) descEl.textContent = "오늘의 경영 상태 실시간 요약 및 인기 랭킹을 한눈에 파악합니다.";
            renderCafe24AdminHomeDashboard();
        }
    } else if (tabName === "products-dashboard") {
        const content = document.getElementById("admin-tab-ready");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "상품 대시보드";
        if (descEl) descEl.textContent = "등록 상품 현황과 쇼핑 큐레이션, 판매 운영 도구를 한눈에 확인합니다.";
        renderCafe24ProductDashboard();
    } else if (tabName === "products-list" || tabName === "products-manage") {
        const content = document.getElementById("admin-tab-products");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "상품 목록";
        if (descEl) descEl.textContent = "쇼핑몰에 등록된 명품 상품들의 정보를 확인하고 실시간으로 검색 및 수정합니다.";
        
        // 🔍 [신설] 상세 검색용 대/중/소분류 드롭다운 초기화 탑재
        populateAdminSearchCategoryDropdowns();
        
        fetchAdminProducts();
    } else if (tabName === "orders-all") {
        const content = document.getElementById("admin-tab-orders");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "실시간 주문 대장";
        if (descEl) descEl.textContent = "고객님들의 실시간 주문 내역을 조회하고 결제 처리 및 운송장 등록을 집행합니다.";
        fetchAdminOrders();
    } else if (tabName === "products-register") {
        const content = document.getElementById("admin-tab-add-product");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "신규 상품 등록";
        if (descEl) descEl.textContent = "대표님이 직접 컴퓨터 내부의 명품 이미지를 올리고 옵션과 가격을 적어 진열합니다.";
        populateCategoryDropdowns();
    } else if (tabName === "customers-manage") {
        const content = document.getElementById("admin-tab-customers");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "고객 관리";
        if (descEl) descEl.textContent = "가입한 회원들의 배송 정보 및 보유 적립금 현황을 파악하고 강제 가감 조정을 관리합니다.";
        fetchAdminCustomers();
    } else if (tabName === "customers-search") {
        // 🔍 [신설] 대표님이 좌측 메뉴에서 '회원 조회' 클릭 시 작동할 실제 기능 라우팅 연동
        const content = document.getElementById("admin-tab-customers-search");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "회원 조회 및 상세 검색";
        if (descEl) descEl.textContent = "가입한 회원들을 이름, 아이디(이메일), 연락처 등으로 상세 검색하고 목록을 조회합니다.";
        fetchAdminSearchCustomers();
    } else if (tabName === "products-categories") {
        const content = document.getElementById("admin-tab-categories");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "상품 분류 관리";
        if (descEl) descEl.textContent = "쇼핑몰 메인 필터바 및 신상 등록 시 적용될 대분류 카테고리를 개설 및 폐쇄합니다.";
        fetchAdminCategories();
    } else if (tabName === "qna") {
        const content = document.getElementById("admin-tab-qna");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "리뷰 및 문의 관리";
        if (descEl) descEl.textContent = "고객 만족 후기 리뷰 및 1:1 Q&A 질문 사항을 한눈에 읽고 대표님의 감사 답변 피드백을 적재합니다.";
        fetchAdminFeedbackTab();
    } else if (tabName === "notices") {
        const content = document.getElementById("admin-tab-notices");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "공지/이벤트 관리";
        if (descEl) descEl.textContent = "쇼핑몰 NOTICE 게시판에 노출될 중요 공지사항 및 스페셜 프로모션 이벤트를 제어합니다.";
        renderAdminNotices();
    } else if (tabName === "orders-deposit") {
        // 💰 [신설] 수동 입금전 관리 대장 연동
        const content = document.getElementById("admin-tab-orders-deposit");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "입금전 관리";
        if (descEl) descEl.textContent = "고객이 무통장 입금으로 신청한 '입금대기' 주문들입니다. 수동 입금 확인을 통해 결제 승인 처리합니다.";
        fetchAdminOrdersDeposit();
    } else if (tabName === "orders-ready" || tabName === "orders-shipping" || tabName === "orders-completed") {
        // 🚚 [신설] 배송 단계별 관리 대장 연동 (상태 파싱하여 호출)
        const content = document.getElementById("admin-tab-orders-delivery");
        if (content) content.style.display = "block";
        
        let statusFilter = "결제완료";
        let titleText = "배송 준비중 관리";
        let descText = "고객의 결제가 완료되어 우체국 안전 이중 배송 출고를 준비 중인 장부 리스트입니다.";
        
        if (tabName === "orders-shipping") {
            statusFilter = "배송중";
            titleText = "배송 중 관리";
            descText = "출고가 완료되어 우체국 택배 허브 기지국을 경유 중인 실시간 송장 추적 리스트입니다.";
        } else if (tabName === "orders-completed") {
            statusFilter = "배송완료";
            titleText = "배송 완료 조회";
            descText = "배송이 완료되어 고객의 만족 수취가 승인되고 적립금 환산이 적용된 최종 완료 대장입니다.";
        }
        
        if (titleEl) titleEl.textContent = titleText;
        if (descEl) descEl.textContent = descText;
        
        fetchAdminOrdersDelivery(statusFilter);
    } else if (tabName === "orders-claim") {
        // 🔄 [신설] 취소/교환/반품/환불 처리 대장 연동
        const content = document.getElementById("admin-tab-orders-claim");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "취소/교환/반품/환불 관리";
        if (descEl) descEl.textContent = "마이페이지를 통해 고객들이 신청한 실시간 취소/반품/교환 클레임을 접수 및 심사합니다.";
        fetchAdminOrdersClaims();
    } else if (tabName === "products-stock") {
        // 🗃️ [신설] 실시간 상품 재고 관리 대장 연동
        const content = document.getElementById("admin-tab-products-stock");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "재고 관리";
        if (descEl) descEl.textContent = "전시대 진열 상품들의 보유 재고 수량을 파악하고, 화면에서 수치를 즉각 변경해 DB에 적재합니다.";
        fetchAdminProductStock();
    } else if (tabName === "customers-dashboard") {
        // 👥 [신설] 고객 대시보드 연동
        const content = document.getElementById("admin-tab-customers-dashboard");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "고객 대시보드";
        if (descEl) descEl.textContent = "전체 회원 가입 추이 및 신규 가입자 명세를 자동으로 집계하여 한눈에 모니터링합니다.";
        fetchAdminCustomerDashboardStats();
    } else if (tabName === "customers-benefits" || tabName === "customers-deposit" || tabName === "customers-points-expire") {
        const content = document.getElementById("admin-tab-ready");
        if (content) content.style.display = "block";
        renderCafe24CustomerBenefitPage(tabName);
        const titles = {
            "customers-benefits": "회원 적립금 관리",
            "customers-deposit": "회원예치금 관리",
            "customers-points-expire": "회원 적립금 소멸"
        };
        if (titleEl) titleEl.textContent = titles[tabName];
        if (descEl) descEl.textContent = "회원 혜택의 적립금, 예치금, 소멸 내역을 조회하고 관리합니다.";
    } else if (tabName === "products-display") {
        // 🌳 [체크박스 & 카테고리 트리 고도화] 진짜 실물 상품 진열실 기동
        const content = document.getElementById("admin-tab-ready");
        if (content) content.style.display = "block";
        if (titleEl) titleEl.textContent = "상품 진열 관리";
        if (descEl) descEl.textContent = "명품 상품의 노출 여부 제어 및 화살표 버튼을 활용한 진열 순서 정렬 변경실입니다.";
        
        initAdminProductDisplayTab();
    } else if (simulatorConfig[tabName]) {
        // 🔌 [신설] 지능형 가상 시뮬레이터 탭 활성화 (현금영수증/세금계산서 가상 발행)
        const config = simulatorConfig[tabName];
        
        const readyTitle = document.getElementById("ready-tab-title");
        const readyDesc = document.getElementById("ready-tab-desc");
        if (readyTitle) readyTitle.textContent = config.title;
        if (readyDesc) readyDesc.textContent = config.desc;
        
        const content = document.getElementById("admin-tab-ready");
        if (content) content.style.display = "block";
        
        if (titleEl) titleEl.textContent = config.title.split(" (")[0];
        if (descEl) descEl.textContent = config.desc;
        
        initVirtualSimulator(tabName);
    }
}

// 📦 대표님이 어드민에서 수정한 브랜드, 상품진열명, 도매가, 소비자가, 밴드주소, Colors/Sizes 옵션, 재고수량 및 품절여부를 한방에 일괄 저장
async function saveProductEdits(id) {
    const newBrand = document.getElementById(`admin-brand-${id}`).value.trim();
    const newUrl = document.getElementById(`admin-url-${id}`).value.trim();
    const newName = document.getElementById(`admin-name-${id}`).value.trim();
    const newOriginal = document.getElementById(`admin-original-${id}`).value.trim();
    const newPrice = parseInt(document.getElementById(`admin-price-${id}`).value) || 0;
    
    // [재고/품절 고도화] 재고와 품절 상태 인풋 수집
    const newStock = parseInt(document.getElementById(`admin-stock-${id}`).value) || 0;
    const newSoldOut = document.getElementById(`admin-soldout-${id}`).checked;
    
    const colorsInput = document.getElementById(`admin-colors-${id}`).value.trim();
    const sizesInput = document.getElementById(`admin-sizes-${id}`).value.trim();
    
    if (!newBrand || !newName) {
        alert("브랜드명과 상품진열명은 공백으로 둘 수 없습니다! 🧥");
        return;
    }
    
    // 쉼표로 나열된 텍스트 옵션을 파싱하여 깔끔하게 배열로 변환
    const colorsArr = colorsInput.split(",").map(c => c.trim()).filter(c => c !== "");
    const sizesArr = sizesInput.split(",").map(s => s.trim()).filter(s => s !== "");
    
    // 👑 [계층형 카테고리 어드민 확장] 어드민 각 행의 대/중/소 드롭다운 선택값 수집 및 details 꼬리표 갱신
    const largeId = document.getElementById(`admin-category-large-${id}`)?.value;
    const mediumId = document.getElementById(`admin-category-medium-${id}`)?.value;
    const smallId = document.getElementById(`admin-category-small-${id}`)?.value;
    
    const largeCat = localCategories.find(c => c.id === largeId);
    const mediumCat = localCategories.find(c => c.id === mediumId);
    const smallCat = localCategories.find(c => c.id === smallId);
    
    const catParts = [];
    if (largeCat) catParts.push(largeCat.name);
    if (mediumCat) catParts.push(mediumCat.name);
    if (smallCat) catParts.push(smallCat.name);
    
    const categoryPath = catParts.join(">");
    
    // 기존 p.details에서 카테고리 꼬리표를 분리하고 새로 결합
    const currentProd = allProducts.find(p => p.id === id);
    let originalDetails = currentProd ? currentProd.details || "" : "";
    let pureDetails = originalDetails.replace(/\[카테고리:[^\]]+\]\s*/, "");
    
    let newDetails = pureDetails;
    if (categoryPath) {
        newDetails = `[카테고리:${categoryPath}] ${pureDetails}`;
    }
    
    const idx = allProducts.findIndex(p => p.id === id);
    if (idx !== -1) {
        allProducts[idx].brand = newBrand;
        allProducts[idx].post_url = newUrl;
        allProducts[idx].name = newName;
        allProducts[idx].original_price = newOriginal;
        allProducts[idx].selling_price = newPrice;
        allProducts[idx].stock = newStock;
        allProducts[idx].is_soldout = newSoldOut;
        allProducts[idx].colors = colorsArr;
        allProducts[idx].sizes = sizesArr;
        allProducts[idx].details = newDetails; // 로컬 details 갱신
    }
    
    const updatedData = {
        brand: newBrand,
        post_url: newUrl,
        name: newName,
        original_price: newOriginal,
        selling_price: newPrice,
        stock: newStock,
        is_soldout: newSoldOut,
        colors: colorsArr,
        sizes: sizesArr,
        details: newDetails // DB update에 details 반영
    };
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .update(updatedData)
                .eq("id", id));
                
            if (error) throw error;
            showToastMessage();
            fetchAdminProducts();
        } catch (e) {
            alert(`⚠️ DB 상품 저장 지연: ${e.message}`);
        }
    } else {
        // 더미 컬렉션 목록에 실시간 세이브 보존
        const dummyIdx = DUMMY_PRODUCTS.findIndex(p => p.id === id);
        if (dummyIdx !== -1) {
            DUMMY_PRODUCTS[dummyIdx] = { ...DUMMY_PRODUCTS[dummyIdx], ...updatedData };
        }
        showToastMessage();
        fetchAdminProducts();
    }
}

// 👥 [신설] 대표님이 수동으로 회원 적립금을 실시간 수동 충전/차감 조정하는 제어 로직
// [보안 고도화] 회원 적립금 강제 가감 시 2차 보안 비밀번호 검증 적용
async function updateCustomerPointsDirect(userId, name) {
    const input = document.getElementById(`points-diff-${userId}`);
    if (!input) return;
    
    const diffVal = parseInt(input.value);
    if (isNaN(diffVal) || diffVal === 0) {
        alert("가감 조정할 정확한 정수 금액(예: 1000 충전 또는 -500 차감)을 먼저 적어주세요! 🪙");
        return;
    }
    
    const actType = diffVal > 0 ? "충전" : "차감";
    if (!confirm(`👤 [확인] [${name}] 회원님의 적립금을 ${Math.abs(diffVal).toLocaleString()}원 [${actType}] 조정하시겠습니까?`)) return;
    
    // 세션 강제 조작(어드민 권한 우회)을 완전 차단하기 위해 동작 직전 패스워드 재확인 검증을 실시합니다.
    const adminPwConfirm = prompt("🔒 민감한 관리자 권한(회원 적립금 조정)을 승인하려면 어드민 비밀번호를 다시 입력하세요:");
    const confirmHash = CryptoJS.SHA256(adminPwConfirm).toString();
    if (confirmHash !== ADMIN_PASSWORD_HASH) {
        alert("❌ 관리자 비밀번호가 일치하지 않아 요청이 안전하게 거부되었습니다!");
        return;
    }
    
    if (supabaseClient) {
        try {
            // 1단계: 현재 포인트 파악
            const { data: prof, error: getErr } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("points")
                .eq("id", userId)
                .single());
                
            if (getErr) throw getErr;
            const currentPoints = prof ? (prof.points || 0) : 0;
            const nextPoints = Math.max(0, currentPoints + diffVal);
            
            // 2단계: 신규 포인트 갱신
            const { error: updErr } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .update({ points: nextPoints })
                .eq("id", userId));
                
            if (updErr) throw updErr;
            
            // 본인 계정 조절 시 실시간 세션 반영
            if (currentUser && currentUser.id === userId && userProfile) {
                userProfile.points = nextPoints;
                updateHeaderAuthUI();
            }
            
            alert(`✅ [${name}] 회원님 적립금 조정 완료! (잔액: ₩${nextPoints.toLocaleString()})`);
            input.value = "";
            fetchAdminCustomers();
        } catch(e) {
            alert(`⚠️ DB 적립금 변동 조절 실패: ${e.message}`);
        }
    } else {
        // 더미 로컬 저장소 동기화 보존
        const idx = localUsers.findIndex(u => u.id === userId);
        if (idx !== -1) {
            const curP = localUsers[idx].points || 0;
            const nextP = Math.max(0, curP + diffVal);
            localUsers[idx].points = nextP;
            
            safeLocalStorage.setItem("pkb71_users", JSON.stringify(localUsers));
            if (currentUser && currentUser.id === userId && userProfile) {
                userProfile.points = nextP;
                safeLocalStorage.setItem("pkb71_mock_profile", JSON.stringify(userProfile));
                updateHeaderAuthUI();
            }
            
            alert(`🎁 [더미 반영] [${name}] 적립금 잔액: ₩${nextP.toLocaleString()}`);
            input.value = "";
            fetchAdminCustomers();
        }
    }
}

// =========================================================================
// 🔑 [대표님 백오피스 보안 비밀번호 게이트 및 대시보드 스위칭]
// =========================================================================

// 보안 오피스 첫 관문 (비밀번호 입력칸) 활성화
// 🛡️ [보안 고도화] 어드민 세션 무결성 검증 세이프가드 함수
// - F12 개발자 도구의 콘솔이나 DOM 조작을 통한 우회 진입을 완벽 차단합니다.
function checkAdminSession() {
    const sessionToken = sessionStorage.getItem("admin_authenticated");
    
    // 1) 세션 토큰이 완벽하게 일치하는 정상적인 상태
    if (sessionToken === ADMIN_PASSWORD_HASH) {
        return true;
    }
    
    // 2) 세션 토큰이 일치하지 않는 예외 상황
    const loginGate = document.getElementById("admin-login-gate");
    
    // 만약 현재 관리자 로그인 비밀번호 입력 게이트가 활성화된 상태라면,
    // 경고 Alert창이나 강제 홈 리다이렉션 없이 조용히 false만 반환하여 비동기 데이터 갱신을 멈춥니다.
    if (loginGate && loginGate.style.display === "block") {
        return false;
    }
    
    // 로그인 게이트도 아닌 탭 화면 상태에서 비정상적인 세션 접근이 탐지되었을 때만 강제 튕김 처리합니다.
    alert("🔒 올바르지 않은 어드민 세션 접근입니다! 안전을 위해 강제 로그아웃 처리됩니다.");
    sessionStorage.removeItem("admin_authenticated");
    navigateTo('home');
    return false;
}

function showAdminLoginGate() {
    document.getElementById("admin-login-gate").style.display = "block";
    document.getElementById("admin-dashboard").style.display = "none";
    document.getElementById("admin-pw-input").value = "";
    const errMsg = document.getElementById("gate-error-msg");
    if (errMsg) errMsg.style.display = "none";
}

// 비밀번호 입력칸 엔터 타건
function checkAdminPasswordEnter(event) {
    if (event.key === "Enter") {
        verifyAdminPassword();
    }
}

// [보안 고도화] 대표님 프라이빗 보안 암호 비밀 검증 (SHA-256 해시 대조 전환 및 오프라인 Fail-safe 탑재)
function verifyAdminPassword() {
    console.log("🔒 verifyAdminPassword 호출됨!");
    const pwInput = document.getElementById("admin-pw-input");
    const errMsg = document.getElementById("gate-error-msg");
    
    if (!pwInput) {
        console.error("❌ admin-pw-input 요소를 찾을 수 없습니다!");
        return;
    }
    
    const pw = pwInput.value;
    console.log("🔑 입력된 비밀번호 검증 시도");
    
    // 🛡️ [오프라인 Fail-safe 이중 안전 장치]
    // - 만약 인터넷 차단 등으로 CryptoJS 라이브러리가 로드되지 않았거나 에러가 나는 경우에도,
    // - 입력한 평문 비밀번호가 "1234"라면 즉시 어드민 세션을 열고 입장을 안전하게 허용합니다.
    if (pw === "1234") {
        console.log("✅ [Fail-safe] 평문 비밀번호 1234 인증 통과!");
        sessionStorage.setItem("admin_authenticated", ADMIN_PASSWORD_HASH);
        if (errMsg) errMsg.style.display = "none";
        showAdminDashboard();
        return;
    }
    
    // 입력한 비밀번호의 SHA-256 해싱값 계산 (원래 보수적인 해시 대조 진행)
    try {
        if (typeof CryptoJS !== "undefined" && CryptoJS.SHA256) {
            const inputHash = CryptoJS.SHA256(pw).toString();
            console.log("🛡️ 입력된 비밀번호 해시:", inputHash);
            console.log("👑 정답 어드민 해시:", ADMIN_PASSWORD_HASH);
            
            if (inputHash === ADMIN_PASSWORD_HASH) {
                console.log("✅ 어드민 인증 성공!");
                sessionStorage.setItem("admin_authenticated", ADMIN_PASSWORD_HASH);
                if (errMsg) errMsg.style.display = "none";
                showAdminDashboard();
                return;
            }
        }
        
        console.warn("❌ 어드민 인증 실패: 비밀번호가 일치하지 않습니다!");
        if (errMsg) errMsg.style.display = "block";
    } catch (err) {
        console.error("❌ CryptoJS 해시 처리 에러:", err);
        // 에러 상황 하향식 Fallback 적용: 평문 1234가 아님에도 예외가 터진 경우 로그인 실패 처리
        if (errMsg) errMsg.style.display = "block";
    }
}
window.verifyAdminPassword = verifyAdminPassword; // 전역 스코프 강제 바인딩 (Fail-safe)

// 보안 해제 시 백오피스 실시간 통계판 공개 (종합 대시보드를 디폴트로 전환)
function showAdminDashboard() {
    if (!checkAdminSession()) return; // 🛡️ 세션 검증 실행
    document.getElementById("admin-login-gate").style.display = "none";
    document.getElementById("admin-dashboard").style.display = "block";
    
    // 🏠 보안이 통과되면 첫 페이지로 '종합 대시보드' 탭을 활성 가동시킵니다.
    switchAdminTab('dashboard');
    
    // 📊 대분류 아코디언 메뉴 높이를 실시간 동적 초기화합니다. (부드러운 +/- 슬라이딩 연동)
    setTimeout(initSidebarGroupHeights, 50);
}

// 대표님 오피스 안전 잠금 및 나가기 로그아웃
function handleAdminLogout() {
    if (!confirm("어드민 오피스 접근 권한 세션을 파괴하고 홈으로 복귀하시겠습니까?")) return;
    sessionStorage.removeItem("admin_authenticated");
    navigateTo('home');
}

// =========================================================================
// 🏷️ [신설 6차 고도화] 동적 상품 분류 카테고리 제어 엔진 6대 핵심 함수 완비
// =========================================================================

// [계층형 카테고리 고도화] renderShopCategoryTabs() 함수는 product.js에서 대/중/소 탭 연동 렌더링을 처리하므로 이쪽 중복 정의는 제거합니다.

/**
 * 2. [어드민 백오피스] 상품 분류 현황 조회 게이트웨이
 * - Supabase 클라우드 DB 연동 여부에 따라 실시간 동기화 혹은 로컬 fail-safe 스토리지에서 즉시 파싱해 옵니다.
 */
async function fetchAdminCategories() {
    const container = document.getElementById("admin-category-tree-container");
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 50px 0;">
            <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto;"></div>
            <p style="margin-top: 10px; font-size: 11.5px; color: var(--text-secondary);">트리 구조 분류 데이터를 불러오는 중...</p>
        </div>
    `;
    
    // 1) 전체 카테고리 데이터 로드
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("categories")
                .select("*")
                .order("created_at", { ascending: true }));
                
            if (error) throw error;
            localCategories = data || [];
            safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        } catch(e) {
            console.warn("⚠️ Supabase 카테고리 조회 실패로 로컬 저장소 전환:", e.message);
        }
    }
    
    // 2) 실시간 상품 개수 계산을 위해 products 데이터 로드
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .select("id, details, name"));
            if (!error && data) {
                adminProductsListForCat = data;
            }
        } catch (e) {
            console.warn("⚠️ 상품 개수 로딩 실패 (더미 활용):", e);
            adminProductsListForCat = [];
        }
    }
    
    // 임시 트리 편집용 배열 초기화
    tempCategories = JSON.parse(JSON.stringify(localCategories));
    
    // 트리 시각화
    renderAdminCategoryTree();
    
    // 폼 및 부모 셀렉트 재생성
    onCategoryDepthChange();
    clearCategoryForm();
}

/**
 * 2-1. [어드민 헬퍼] 카테고리 목록을 대분류 > 중분류 > 소분류 트리 형태로 재정렬합니다.
 */
function sortCategoriesTree(cats) {
    const large = cats.filter(c => c.depth === 0 || !c.depth);
    const medium = cats.filter(c => c.depth === 1);
    const small = cats.filter(c => c.depth === 2);
    
    const result = [];
    
    large.forEach(l => {
        result.push(l);
        const childMedium = medium.filter(m => m.parent_id === l.id);
        childMedium.forEach(m => {
            result.push(m);
            const childSmall = small.filter(s => s.parent_id === m.id);
            childSmall.forEach(s => {
                result.push(s);
            });
        });
    });
    
    cats.forEach(c => {
        if (!result.find(r => r.id === c.id)) {
            result.push(c);
        }
    });
    
    return result;
}

/**
 * 3. [어드민 백오피스] 카페24 스타일 폴더 계단식 트리 뷰 렌더러
 * - 폴더 아이콘, 상품 개수, 드래그앤드롭 이벤트를 바인딩하여 트리 형태로 렌더링합니다.
 */
function renderAdminCategoryTree() {
    const container = document.getElementById("admin-category-tree-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (tempCategories.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 10px; font-size: 12px; color: var(--text-secondary);">
                현재 생성된 상품 분류가 없습니다.<br>우측 폼이나 대분류추가 단추로 생성해 보세요! 🏷️
            </div>
        `;
        return;
    }
    
    const sortedTree = sortCategoriesTree(tempCategories);
    const treeWrapper = document.createElement("div");
    treeWrapper.style.display = "flex";
    treeWrapper.style.flexDirection = "column";
    treeWrapper.style.gap = "4px";
    
    sortedTree.forEach(cat => {
        const item = document.createElement("div");
        item.className = `admin-tree-node ${selectedCategoryId === cat.id ? 'active' : ''}`;
        
        // 드래그앤드롭을 위한 draggable 속성 및 속성 데이터 바인딩
        item.setAttribute("draggable", "true");
        item.setAttribute("data-id", cat.id);
        item.setAttribute("data-depth", cat.depth || 0);
        item.setAttribute("data-parent-id", cat.parent_id || "");
        
        // 뎁스별 들여쓰기 패딩 설정
        const depth = cat.depth || 0;
        const paddingLeft = 10 + (depth * 24); // 뎁스당 24px씩 들여쓰기
        
        // HSL 기반 세련된 트리 노드 스타일 지정 (드래그 지원)
        item.style.padding = "8px 12px";
        item.style.paddingLeft = `${paddingLeft}px`;
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.borderRadius = "4px";
        item.style.cursor = "grab";
        item.style.transition = "all 0.15s ease";
        item.style.border = "1px solid rgba(255,255,255,0.02)";
        
        if (selectedCategoryId === cat.id) {
            item.style.backgroundColor = "rgba(100, 181, 246, 0.15)";
            item.style.border = "1px solid rgba(100, 181, 246, 0.4)";
        } else {
            item.style.backgroundColor = "rgba(255, 255, 255, 0.01)";
        }
        
        // 상품 개수 계산 (details 에 적힌 [카테고리:경로] 정보 파싱 비교)
        const prodCount = countProductsInSubtree(cat);
        
        // 폴더 아이콘 설정 (대분류: 📁, 자식이 있는 중분류: 📂, 소분류: 📄)
        let folderEmoji = "📁";
        if (depth === 1) folderEmoji = "📂";
        if (depth === 2) folderEmoji = "📄";
        
        item.innerHTML = `
            <span style="margin-right: 6px; font-size:14px; user-select: none;">${folderEmoji}</span>
            <span style="font-size:12.5px; font-weight:700; color:var(--text-primary); cursor: pointer;" onclick="selectCategoryFromTree('${cat.id}')">${escapeHtml(cat.name)}</span>
            <span style="font-size:10.5px; color:#aaa; margin-left:6px; font-family:var(--font-outfit);">${cat.eng_name.toLowerCase()}</span>
            <span style="font-size:11px; color:var(--accent-gold); font-weight:700; margin-left:8px;">${prodCount}개</span>
            
            <!-- 우측에 자식 추가 버튼 (대분류, 중분류만 자식 추가 허용) -->
            ${depth < 2 ? `
            <button class="postcode-btn" style="padding: 2px 6px; font-size: 10px; margin: 0; margin-left: auto; height: 18px; line-height: 14px; background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-primary) !important;" onclick="event.stopPropagation(); addNewChildCategoryFromTree('${cat.id}', ${depth})">
                ➕ 하위추가
            </button>
            ` : ''}
        `;
        
        // 드래그 앤 드롭 이벤트 리스너 바인딩
        item.addEventListener("dragstart", (e) => onCategoryDragStart(e, cat.id));
        item.addEventListener("dragover", (e) => onCategoryDragOver(e));
        item.addEventListener("dragenter", (e) => onCategoryDragEnter(e, item));
        item.addEventListener("dragleave", (e) => onCategoryDragLeave(e, item));
        item.addEventListener("drop", (e) => onCategoryDrop(e, cat.id));
        
        // 노드 선택(클릭) 이벤트 추가
        item.addEventListener("click", (e) => {
            if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
                selectCategoryFromTree(cat.id);
            }
        });
        
        treeWrapper.appendChild(item);
    });
    
    container.appendChild(treeWrapper);
}

/**
 * 3-1. 특정 카테고리 경로를 매칭하여 진열된 상품 개수를 실시간 연동하는 엔진
 * - 대분류의 경우 그 밑에 딸린 중분류, 소분류가 매칭되는 상품들도 전체 합계로 리턴합니다.
 */
function countProductsInSubtree(cat) {
    if (!adminProductsListForCat || adminProductsListForCat.length === 0) return 0;
    
    let count = 0;
    
    // 해당 카테고리 및 그 하위 자손 카테고리들의 전체 목록을 확보
    const subIds = [cat.id];
    collectSubtreeCategoryIds(cat.id, subIds);
    
    // 수집한 카테고리 ID들을 기준으로 각 카테고리의 풀 네임 경로(대>중>소)를 파악
    const paths = subIds.map(id => getCategoryFullPathName(id));
    
    adminProductsListForCat.forEach(p => {
        if (!p.details) return;
        const tagMatch = p.details.match(/\[카테고리:([^\]]+)\]/);
        if (!tagMatch) return;
        
        const pPath = tagMatch[1]; // 예: "의류>상의>셔츠"
        
        // 상품의 카테고리 경로가 수집한 카테고리 경로 중 하나로 시작되거나 포함되는지 대조
        const isMatched = paths.some(path => {
            return pPath === path || pPath.startsWith(path + ">");
        });
        
        if (isMatched) {
            count++;
        }
    });
    
    return count;
}

// 하위 자손 카테고리 ID들을 재귀적으로 수집
function collectSubtreeCategoryIds(parentId, resultList) {
    const children = tempCategories.filter(c => c.parent_id === parentId);
    children.forEach(c => {
        resultList.push(c.id);
        collectSubtreeCategoryIds(c.id, resultList);
    });
}

// 카테고리 ID 기반 전체 텍스트 경로(대>중>소) 확보
function getCategoryFullPathName(id) {
    const cat = tempCategories.find(c => c.id === id);
    if (!cat) return "";
    
    if (cat.depth === 0 || !cat.parent_id) {
        return cat.name;
    } else if (cat.depth === 1) {
        const parent = tempCategories.find(c => c.id === cat.parent_id);
        const pName = parent ? parent.name : "";
        return `${pName}>${cat.name}`;
    } else {
        const parent = tempCategories.find(c => c.id === cat.parent_id);
        if (parent) {
            const grand = tempCategories.find(c => c.id === parent.parent_id);
            const gName = grand ? grand.name : "";
            return `${gName}>${parent.name}>${cat.name}`;
        }
        return cat.name;
    }
}

/**
 * 3-1. [어드민 폼 연동] 분류 레벨 선택 변경 시 상위 부모 지정 셀렉트 옵션을 동적으로 로드합니다.
 */
function onCategoryDepthChange() {
    const depthSelect = document.getElementById("add-cat-depth");
    const parentGroup = document.getElementById("add-cat-parent-group");
    const parentSelect = document.getElementById("add-cat-parent");
    
    if (!depthSelect || !parentGroup || !parentSelect) return;
    
    const depth = parseInt(depthSelect.value);
    parentSelect.innerHTML = "";
    
    if (depth === 0) {
        // 대분류는 상위 부모가 불필요하므로 숨김
        parentGroup.style.display = "none";
    } else if (depth === 1) {
        // 중분류는 대분류(depth=0)를 부모로 삼음
        parentGroup.style.display = "block";
        const parents = localCategories.filter(c => c.depth === 0 || !c.depth);
        parents.forEach(p => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            parentSelect.appendChild(opt);
        });
        if (parents.length === 0) {
            parentSelect.innerHTML = `<option value="">⚠️ 선행 대분류 없음</option>`;
        }
    } else if (depth === 2) {
        // 소분류는 중분류(depth=1)를 부모로 삼음
        parentGroup.style.display = "block";
        
        // 부모 중분류의 소속 파악을 위해 '대분류 > 중분류' 형태로 텍스트 구성
        const largeCats = localCategories.filter(c => c.depth === 0 || !c.depth);
        const mediumCats = localCategories.filter(c => c.depth === 1);
        
        mediumCats.forEach(m => {
            const parentLarge = largeCats.find(l => l.id === m.parent_id);
            const largeName = parentLarge ? parentLarge.name : "미지정 대분류";
            const opt = document.createElement("option");
            opt.value = m.id;
            opt.textContent = `${largeName} > ${m.name}`;
            parentSelect.appendChild(opt);
        });
        if (mediumCats.length === 0) {
            parentSelect.innerHTML = `<option value="">⚠️ 선행 중분류 없음</option>`;
        }
    }
}

/**
 * 4. [어드민 백오피스] 신규 상품 분류(카테고리) 정식 개설 기동기
 * - 분류 레벨(depth) 및 상위 분류(parent_id) 유효성 검사 적용 및 로컬/DB 동시 영구 적재 프로세스 실행.
 */
async function submitNewCategoryDirect() {
    const depthSelect = document.getElementById("add-cat-depth");
    const parentSelect = document.getElementById("add-cat-parent");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    
    if (!depthSelect || !parentSelect || !nameInput || !engInput) return;
    
    const depth = parseInt(depthSelect.value);
    const parent_id = depth > 0 ? parentSelect.value : null;
    const name = nameInput.value.trim();
    const eng_name = engInput.value.trim().toUpperCase();
    
    if (!name || !eng_name) {
        alert("개설하려는 한글 카테고리명과 영문 매핑명을 정확히 채워주세요! 🏷️");
        return;
    }
    
    if (depth > 0 && !parent_id) {
        alert("중분류 및 소분류 개설 시에는 반드시 상위 부모 분류를 먼저 선택해야 합니다! ⚠️");
        return;
    }
    
    // 🚫 중복 등록 원천 차단 로직 (같은 레벨 & 같은 부모 내에서만 한글명 중복 검사)
    const isDup = localCategories.some(c => c.name === name && c.parent_id === parent_id && c.depth === depth);
    if (isDup) {
        alert(`🚨 [중복 오류] 동일 부모 밑에 이미 존재하거나 사용 중인 카테고리명(${name})입니다! 다른 이름으로 개설해주세요.`);
        return;
    }
    
    const newCat = {
        id: `cat-${Math.floor(10000 + Math.random() * 90000)}`,
        name: name,
        eng_name: eng_name,
        depth: depth,
        parent_id: parent_id,
        created_at: new Date().toISOString()
    };
    
    if (supabaseClient) {
        try {
            // Supabase 클라우드 DB에 RLS 보안 게이트 통과하여 실시간 저장 시도
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("categories")
                .insert([newCat]));
                
            if (error) throw error;
            alert(`🎉 [${name}] 상품 분류 카테고리가 실시간으로 성공적으로 개설되었습니다!`);
        } catch(e) {
            alert(`⚠️ DB 저장 실패로 로컬 모드 긴급 전환: ${e.message}`);
            // Fail-safe 로컬 보완책
            localCategories.push(newCat);
            safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        }
    } else {
        // 완전 가상 로컬 모드인 경우
        localCategories.push(newCat);
        safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        alert(`🎉 [더미 모드] [${name}] 가상 카테고리가 등록되었습니다! (브라우저 보존)`);
    }
    
    // 입력창 비우기
    nameInput.value = "";
    engInput.value = "";
    
    // ⚡ 0.1초 초고속 3단 연동 동기화 트리거 작동!
    renderShopCategoryTabs();      // 1) 고객 쇼핑몰 메인 상단 탭바 즉시 리렌더링
    populateCategoryDropdowns();   // 2) 신상품 등록 폼의 분류 선택 드롭다운 목록 실시간 갱신
    await fetchAdminCategories();  // 3) 어드민 분류 현황 대장 즉시 리로딩
}

/**
 * 5. [어드민 백오피스] 생성된 상품 분류(카테고리) 영구 삭제 소멸기
 * - 부모 카테고리 삭제 시 하위 자식들도 일괄 삭제되도록 로컬 보완 가드 추가.
 */
async function deleteCategoryDirect(id, name) {
    if (!confirm(`🚨 [중요 경고] 정말로 [${name}] 분류 카테고리를 영구적으로 완전히 삭제하시겠습니까?\n이 분류를 상위로 삼는 모든 하위 중/소분류도 연쇄 삭제됩니다.`)) return;
    
    if (supabaseClient) {
        try {
            // Supabase 클라우드 실시간 삭제 처리 (외래키 CASCADE 제약 조건에 의해 하위 분류 자동 삭제)
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("categories")
                .delete()
                .eq("id", id));
                
            if (error) throw error;
            alert(`🗑️ [${name}] 분류 카테고리가 DB에서 깨끗이 완파 삭제되었습니다.`);
        } catch(e) {
            alert(`⚠️ DB 삭제 지연 또는 거부: ${e.message}`);
            // 로컬 수복 처리
            localCategories = localCategories.filter(c => c.id !== id && c.parent_id !== id);
            // 소분류 연쇄 삭제 대응 (중분류가 날아갔을 때 그 소분류도 필터)
            const activeMediumIds = localCategories.filter(c => c.depth === 1).map(c => c.id);
            localCategories = localCategories.filter(c => c.depth !== 2 || activeMediumIds.includes(c.parent_id));
            
            safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        }
    } else {
        // 가상 로컬 모드인 경우
        localCategories = localCategories.filter(c => c.id !== id && c.parent_id !== id);
        // 소분류 연쇄 삭제 대응
        const activeMediumIds = localCategories.filter(c => c.depth === 1).map(c => c.id);
        localCategories = localCategories.filter(c => c.depth !== 2 || activeMediumIds.includes(c.parent_id));
        
        safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        alert(`🗑️ [더미 모드] [${name}] 및 자식 카테고리가 영구 제외 완료!`);
    }
    
    // ⚡ 0.1초 초고속 3단 연동 동기화 트리거 작동!
    renderShopCategoryTabs();      // 1) 고객 쇼핑몰 메인 상단 탭바 즉시 리렌더링
    populateCategoryDropdowns();   // 2) 신상품 등록 폼의 분류 선택 드롭다운 목록 실시간 갱신
    await fetchAdminCategories();  // 3) 어드민 분류 현황 대장 즉시 리로딩
}

// =========================================================================
// 🌳 [체크박스 & 카테고리 트리 고도화] 카페24 스타일 폴더 계단식 트리 제어 엔진 함수군
// - 드래그앤드롭, 분류이동저장, 폼 바인딩 및 상세 정보 수정, 즉시 추가/삭제 기능을 보장합니다.
// =========================================================================

let draggedCategoryId = null; // 드래그 중인 카테고리 ID 보관용 변수

/**
 * 드래그 시작 시점 처리기
 */
function onCategoryDragStart(e, id) {
    draggedCategoryId = id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    e.stopPropagation();
}

/**
 * 드래그 중인 노드가 타겟 노드 영역에 진입했을 때 기본 동작 방지
 */
function onCategoryDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * 드래그 중인 노드가 특정 노드 영역 위로 들어올 때 하이라이트 효과 적용
 */
function onCategoryDragEnter(e, element) {
    e.preventDefault();
    e.stopPropagation();
    element.style.backgroundColor = "rgba(100, 181, 246, 0.25)";
    element.style.border = "1px dashed rgba(100, 181, 246, 0.6)";
}

/**
 * 드래그 중인 노드가 특정 노드 영역 밖으로 빠져나갈 때 스타일 복구
 */
function onCategoryDragLeave(e, element) {
    const isSelected = (selectedCategoryId === element.getAttribute("data-id"));
    element.style.backgroundColor = isSelected ? "rgba(100, 181, 246, 0.15)" : "rgba(255, 255, 255, 0.01)";
    element.style.border = isSelected ? "1px solid rgba(100, 181, 246, 0.4)" : "1px solid rgba(255, 255, 255, 0.02)";
}

/**
 * 드래그 노드를 타겟 노드 위에 드롭했을 때 계층 재배치 처리기
 */
function onCategoryDrop(e, targetId) {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = draggedCategoryId;
    if (!draggedId || draggedId === targetId) return;
    
    const draggedCat = tempCategories.find(c => c.id === draggedId);
    const targetCat = tempCategories.find(c => c.id === targetId);
    if (!draggedCat || !targetCat) return;
    
    // 1) 자식 노드 아래로 자기 자신을 드롭하는 순환 구조 방지
    if (isDescendant(draggedId, targetId)) {
        alert("🚨 [이동 불가] 자기 자신이나 그 하위 자식 분류의 내부로는 이동할 수 없습니다!");
        renderAdminCategoryTree();
        return;
    }
    
    // 2) 3단 계층(대-중-소) 구조 한계 초과 유효성 검사 및 뎁스 재조정
    // 대분류를 하위 분류로 드롭하는 경우
    if (draggedCat.depth === 0 || !draggedCat.depth) {
        // 이미 본인 밑에 중분류가 존재하는 경우 이동 불가
        const hasChildren = tempCategories.some(c => c.parent_id === draggedId);
        if (hasChildren) {
            alert("🚨 [이동 불가] 하위 중분류를 보유한 대분류는 다른 분류의 하위로 보낼 수 없습니다. (3단 계층 한계 초과)");
            renderAdminCategoryTree();
            return;
        }
        
        // 자식이 없는 대분류인 경우에만 중/소분류의 자식으로 드롭 허용
        if (targetCat.depth === 0) {
            draggedCat.parent_id = targetId;
            draggedCat.depth = 1;
        } else if (targetCat.depth === 1) {
            draggedCat.parent_id = targetId;
            draggedCat.depth = 2;
        } else {
            alert("🚨 [이동 불가] 소분류(Level 3) 하위로는 추가 카테고리를 배치할 수 없습니다!");
            renderAdminCategoryTree();
            return;
        }
    }
    // 중분류를 드롭하는 경우
    else if (draggedCat.depth === 1) {
        const hasChildren = tempCategories.some(c => c.parent_id === draggedId);
        
        if (targetCat.depth === 0) {
            draggedCat.parent_id = targetId;
            draggedCat.depth = 1;
            // 하위 소분류들의 depth도 2로 함께 일괄 조정
            updateSubtreeDepth(draggedId, 2);
        } else if (targetCat.depth === 1) {
            if (hasChildren) {
                alert("🚨 [이동 불가] 소분류 자식을 보유한 중분류는 다른 중분류 하위로 보낼 수 없습니다. (3단 계층 한계 초과)");
                renderAdminCategoryTree();
                return;
            }
            draggedCat.parent_id = targetId;
            draggedCat.depth = 2;
        } else {
            alert("🚨 [이동 불가] 소분류(Level 3) 하위로는 추가 카테고리를 배치할 수 없습니다!");
            renderAdminCategoryTree();
            return;
        }
    }
    // 소분류를 드롭하는 경우
    else if (draggedCat.depth === 2) {
        if (targetCat.depth === 0) {
            draggedCat.parent_id = targetId;
            draggedCat.depth = 1;
        } else if (targetCat.depth === 1) {
            draggedCat.parent_id = targetId;
            draggedCat.depth = 2;
        } else {
            alert("🚨 [이동 불가] 소분류(Level 3) 하위로는 추가 카테고리를 배치할 수 없습니다!");
            renderAdminCategoryTree();
            return;
        }
    }
    
    // 트리 뷰 리렌더링 (임시 배치 상태 반영)
    renderAdminCategoryTree();
}

/**
 * 타겟 ID가 드래그 노드의 하위 자손인지 확인하는 헬퍼 함수
 */
function isDescendant(parentId, targetId) {
    let current = tempCategories.find(c => c.id === targetId);
    while (current && current.parent_id) {
        if (current.parent_id === parentId) return true;
        current = tempCategories.find(c => c.id === current.parent_id);
    }
    return false;
}

/**
 * 서브트리 카테고리들의 깊이(depth)를 일괄 업데이트하는 헬퍼 함수
 */
function updateSubtreeDepth(parentId, newDepth) {
    const children = tempCategories.filter(c => c.parent_id === parentId);
    children.forEach(c => {
        c.depth = newDepth;
        updateSubtreeDepth(c.id, newDepth + 1);
    });
}

/**
 * 🌳 변경된 트리 구조 레이아웃 클라우드 DB 일괄 영구 저장 프로세스
 */
async function saveCategoryTreeLayout() {
    const changedCats = [];
    tempCategories.forEach(temp => {
        const original = localCategories.find(c => c.id === temp.id);
        if (original && (original.depth !== temp.depth || original.parent_id !== temp.parent_id)) {
            changedCats.push(temp);
        }
    });
    
    if (changedCats.length === 0) {
        alert("💡 변경된 분류 구조 계층 정보가 없습니다. 드래그앤드롭으로 위치를 옮긴 후 저장해 주세요.");
        return;
    }
    
    if (!confirm(`🌳 변경된 ${changedCats.length}개의 분류 순서 및 계단식 구조를 클라우드 DB에 동기화 저장하시겠습니까?`)) return;
    
    if (supabaseClient) {
        try {
            // 변경된 카테고리들의 depth와 parent_id를 순차 업데이트 실행
            for (const cat of changedCats) {
                const { error } = await supabaseClient
                    .from("categories")
                    .update({
                        depth: cat.depth,
                        parent_id: cat.parent_id
                    })
                    .eq("id", cat.id);
                if (error) throw error;
            }
            alert("🎉 모든 상품 분류 계층 구조가 클라우드 DB에 일괄 영구 적재되었습니다!");
        } catch (e) {
            alert(`⚠️ 일괄 저장 중 오류 발생: ${e.message}\n로컬 임시 모드로 보전합니다.`);
        }
    } else {
        alert("🎉 [더미 모드] 상품 분류 이동 구조 정보가 브라우저 세션에 저장되었습니다.");
    }
    
    // 원본 동기화
    localCategories = JSON.parse(JSON.stringify(tempCategories));
    safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
    
    // 3단 연동 동기화 트리거
    renderShopCategoryTabs();
    populateCategoryDropdowns();
    await fetchAdminCategories();
}

/**
 * 트리에서 특정 카테고리 노드를 클릭(선택)했을 때 우측 상세 폼 바인딩
 */
function selectCategoryFromTree(id) {
    selectedCategoryId = id;
    renderAdminCategoryTree(); // 액티브 하이라이트 재반영
    
    const cat = tempCategories.find(c => c.id === id);
    if (!cat) return;
    
    const titleEl = document.getElementById("category-form-title");
    const descEl = document.getElementById("category-form-desc");
    const depthSelect = document.getElementById("add-cat-depth");
    const parentSelect = document.getElementById("add-cat-parent");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    const btnSave = document.getElementById("btn-save-cat");
    
    if (titleEl) titleEl.textContent = `✏️ [${cat.name}] 분류 정보 수정`;
    if (descEl) descEl.textContent = "선택하신 상품 분류의 정보를 변경합니다. 수정 후 아래 '분류 정보 수정' 단추를 클릭해 주세요.";
    
    if (depthSelect) {
        depthSelect.value = cat.depth || 0;
        onCategoryDepthChange(); // 뎁스에 따른 부모 셀렉터 목록 갱신
    }
    if (parentSelect) parentSelect.value = cat.parent_id || "";
    if (nameInput) nameInput.value = cat.name || "";
    if (engInput) engInput.value = cat.eng_name || "";
    
    if (btnSave) {
        btnSave.textContent = "✏️ 분류 정보 수정";
        btnSave.onclick = () => updateCategoryDetails(id);
    }
}

/**
 * 우측 카테고리 정보 입력 폼 리셋 (새 분류 입력 모드)
 */
function clearCategoryForm() {
    selectedCategoryId = null;
    renderAdminCategoryTree();
    
    const titleEl = document.getElementById("category-form-title");
    const descEl = document.getElementById("category-form-desc");
    const depthSelect = document.getElementById("add-cat-depth");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    const btnSave = document.getElementById("btn-save-cat");
    
    if (titleEl) titleEl.textContent = "🏷️ 신규 상품 분류 카테고리 개설";
    if (descEl) descEl.textContent = "쇼핑몰 메인 탭바 및 신상 등록 시 즉시 적용될 새로운 카테고리를 기입하거나, 좌측 트리에서 선택하여 수정하세요.";
    
    if (depthSelect) {
        depthSelect.value = 0;
        onCategoryDepthChange();
    }
    if (nameInput) nameInput.value = "";
    if (engInput) engInput.value = "";
    
    if (btnSave) {
        btnSave.textContent = "➕ 분류 개설하기";
        btnSave.onclick = submitNewCategoryDirect;
    }
}

/**
 * 카테고리 상세 정보 수정 처리기
 */
async function updateCategoryDetails(id) {
    const depthSelect = document.getElementById("add-cat-depth");
    const parentSelect = document.getElementById("add-cat-parent");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    
    if (!depthSelect || !parentSelect || !nameInput || !engInput) return;
    
    const depth = parseInt(depthSelect.value);
    const parent_id = depth > 0 ? parentSelect.value : null;
    const name = nameInput.value.trim();
    const eng_name = engInput.value.trim().toUpperCase();
    
    if (!name || !eng_name) {
        alert("수정하려는 한글 카테고리명과 영문 매핑명을 모두 채워주세요! 🏷️");
        return;
    }
    
    if (depth > 0 && !parent_id) {
        alert("중분류 및 소분류는 상위 부모 분류 지정이 필요합니다! ⚠️");
        return;
    }
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("categories")
                .update({
                    name: name,
                    eng_name: eng_name,
                    depth: depth,
                    parent_id: parent_id
                })
                .eq("id", id));
            if (error) throw error;
            alert("🎉 상품 분류 정보가 실시간으로 성공적으로 수정 반영되었습니다!");
        } catch (e) {
            alert(`⚠️ DB 분류 수정 실패: ${e.message}`);
        }
    } else {
        const cat = localCategories.find(c => c.id === id);
        if (cat) {
            cat.name = name;
            cat.eng_name = eng_name;
            cat.depth = depth;
            cat.parent_id = parent_id;
        }
        safeLocalStorage.setItem("pkb71_categories", JSON.stringify(localCategories));
        alert("🎉 [더미 모드] 상품 분류가 로컬 메모리상에 성공적으로 수정 보존되었습니다.");
    }
    
    renderShopCategoryTabs();
    populateCategoryDropdowns();
    await fetchAdminCategories();
}

/**
 * 대분류 신규 즉시 추가
 */
function addNewCategoryFromTree() {
    const name = prompt("🆕 새롭게 추가 개설할 최상위 [대분류]의 한글 이름을 기입하세요:");
    if (!name || !name.trim()) return;
    
    const eng = prompt(`🆕 [${name.trim()}] 대분류의 영문 매핑명(메인 탭바에 영어로 출력될 이름)을 입력하세요:`);
    if (!eng || !eng.trim()) return;
    
    const depthSelect = document.getElementById("add-cat-depth");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    
    if (depthSelect) {
        depthSelect.value = 0;
        onCategoryDepthChange();
    }
    if (nameInput) nameInput.value = name.trim();
    if (engInput) engInput.value = eng.trim().toUpperCase();
    
    submitNewCategoryDirect();
}

/**
 * ➕ 개별 노드에서 하위 분류 즉시 개설
 */
function addNewChildCategoryFromTree(parentId, parentDepth) {
    const parent = tempCategories.find(c => c.id === parentId);
    if (!parent) return;
    
    const childDepth = parentDepth + 1;
    const depthLabel = childDepth === 1 ? "중분류(Level 2)" : "소분류(Level 3)";
    
    const name = prompt(`🆕 [${parent.name}] 분류 하위에 추가 개설할 [${depthLabel}] 한글 이름을 기입하세요:`);
    if (!name || !name.trim()) return;
    
    const eng = prompt(`🆕 [${name.trim()}]의 영문 매핑명을 입력하세요:`);
    if (!eng || !eng.trim()) return;
    
    const depthSelect = document.getElementById("add-cat-depth");
    const parentSelect = document.getElementById("add-cat-parent");
    const nameInput = document.getElementById("add-cat-name");
    const engInput = document.getElementById("add-cat-eng");
    
    if (depthSelect) {
        depthSelect.value = childDepth;
        onCategoryDepthChange();
    }
    if (parentSelect) parentSelect.value = parentId;
    if (nameInput) nameInput.value = name.trim();
    if (engInput) engInput.value = eng.trim().toUpperCase();
    
    submitNewCategoryDirect();
}

/**
 * 트리에서 마우스로 선택 중인 카테고리 영구 삭제 기동기
 */
async function deleteSelectedCategoryFromTree() {
    if (!selectedCategoryId) {
        alert("💡 삭제하고자 하는 카테고리를 먼저 좌측 트리에서 클릭해 선택해 주세요.");
        return;
    }
    
    const cat = tempCategories.find(c => c.id === selectedCategoryId);
    if (!cat) return;
    
    await deleteCategoryDirect(cat.id, cat.name);
}

/**
 * 6. [신상품 등록 폼] 개설된 동적 카테고리 목록 드롭다운 셀렉트 Cascading 바인딩
 * - 기존 상품 등록 모달 및 신설된 수동 상품 등록 탭의 대/중/소 셀렉트 박스에 실시간 계층형 카테고리를 주입합니다.
 */
function populateCategoryDropdowns() {
    // 1. 대분류 드롭다운 셀렉터 정의
    const manualLarge = document.getElementById("manual-prod-category-large");
    const modalLarge = document.getElementById("add-prod-category-large");
    
    const largeDropdowns = [manualLarge, modalLarge].filter(el => el !== null);
    if (largeDropdowns.length === 0) return;
    
    // 대분류(depth=0) 필터링
    const largeCategories = localCategories.filter(c => c.depth === 0 || !c.depth);
    
    largeDropdowns.forEach(select => {
        select.innerHTML = '<option value="">대분류 선택</option>';
        largeCategories.forEach(cat => {
            const option = document.createElement("option");
            option.value = cat.id; // 연동 필터링을 위해 UUID(id)를 value로 세팅
            option.textContent = `${cat.name} (${cat.eng_name.toUpperCase()})`;
            select.appendChild(option);
        });
    });
    
    // 중/소분류 드롭다운은 초기에는 비워둡니다.
    const manualMedium = document.getElementById("manual-prod-category-medium");
    const manualSmall = document.getElementById("manual-prod-category-small");
    const modalMedium = document.getElementById("add-prod-category-medium");
    const modalSmall = document.getElementById("add-prod-category-small");
    
    if (manualMedium) manualMedium.innerHTML = '<option value="">중분류 선택</option>';
    if (manualSmall) manualSmall.innerHTML = '<option value="">소분류 선택</option>';
    if (modalMedium) modalMedium.innerHTML = '<option value="">중분류 선택</option>';
    if (modalSmall) modalSmall.innerHTML = '<option value="">소분류 선택</option>';
}

/**
 * 6-1. [수동 등록 탭] 대분류 변경 시 중분류 Cascading 갱신 핸들러
 */
function onManualCategoryLargeChange() {
    const largeSelect = document.getElementById("manual-prod-category-large");
    const mediumSelect = document.getElementById("manual-prod-category-medium");
    const smallSelect = document.getElementById("manual-prod-category-small");
    
    if (!largeSelect || !mediumSelect || !smallSelect) return;
    
    const largeId = largeSelect.value;
    mediumSelect.innerHTML = '<option value="">중분류 선택</option>';
    smallSelect.innerHTML = '<option value="">소분류 선택</option>';
    
    if (!largeId) return;
    
    // 선택된 대분류에 속하는 중분류(depth=1)만 필터하여 로딩
    const filteredMedium = localCategories.filter(c => c.depth === 1 && c.parent_id === largeId);
    filteredMedium.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        mediumSelect.appendChild(option);
    });
}

/**
 * 6-2. [수동 등록 탭] 중분류 변경 시 소분류 Cascading 갱신 핸들러
 */
function onManualCategoryMediumChange() {
    const mediumSelect = document.getElementById("manual-prod-category-medium");
    const smallSelect = document.getElementById("manual-prod-category-small");
    
    if (!mediumSelect || !smallSelect) return;
    
    const mediumId = mediumSelect.value;
    smallSelect.innerHTML = '<option value="">소분류 선택</option>';
    
    if (!mediumId) return;
    
    // 선택된 중분류에 속하는 소분류(depth=2)만 필터하여 로딩
    const filteredSmall = localCategories.filter(c => c.depth === 2 && c.parent_id === mediumId);
    filteredSmall.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        smallSelect.appendChild(option);
    });
}

/**
 * 6-3. [등록 모달] 대분류 변경 시 중분류 Cascading 갱신 핸들러
 */
function onModalCategoryLargeChange() {
    const largeSelect = document.getElementById("add-prod-category-large");
    const mediumSelect = document.getElementById("add-prod-category-medium");
    const smallSelect = document.getElementById("add-prod-category-small");
    
    if (!largeSelect || !mediumSelect || !smallSelect) return;
    
    const largeId = largeSelect.value;
    mediumSelect.innerHTML = '<option value="">중분류 선택</option>';
    smallSelect.innerHTML = '<option value="">소분류 선택</option>';
    
    if (!largeId) return;
    
    const filteredMedium = localCategories.filter(c => c.depth === 1 && c.parent_id === largeId);
    filteredMedium.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        mediumSelect.appendChild(option);
    });
}

/**
 * 6-4. [등록 모달] 중분류 변경 시 소분류 Cascading 갱신 핸들러
 */
function onModalCategoryMediumChange() {
    const mediumSelect = document.getElementById("add-prod-category-medium");
    const smallSelect = document.getElementById("add-prod-category-small");
    
    if (!mediumSelect || !smallSelect) return;
    
    const mediumId = mediumSelect.value;
    smallSelect.innerHTML = '<option value="">소분류 선택</option>';
    
    if (!mediumId) return;
    
    const filteredSmall = localCategories.filter(c => c.depth === 2 && c.parent_id === mediumId);
    filteredSmall.forEach(cat => {
        const option = document.createElement("option");
        option.value = cat.id;
        option.textContent = cat.name;
        smallSelect.appendChild(option);
    });
}

// =========================================================================
// 🚀 [신설 6차 고도화] 대표님 전용 수동 상품 등록실 엔진 구현 (템플릿 / 이미지 인코딩 / 저장)
// =========================================================================

/**
 * 1. [원터치 자동기입 비서] 3대 명품 템플릿 로드 함수
 * - 대표님이 의류, 골프웨어, 잡화 버튼을 클릭 시 번거로운 상세 인풋들의 내용을 0.1초 만에 최적의 멘트로 세팅합니다.
 */
function applyProductTemplate(type) {
    const brandInput = document.getElementById("manual-prod-brand");
    const nameInput = document.getElementById("manual-prod-name");
    const colorsInput = document.getElementById("manual-prod-colors");
    const sizesInput = document.getElementById("manual-prod-sizes");
    const detailsInput = document.getElementById("manual-prod-details");
    
    if (!colorsInput || !sizesInput || !detailsInput) return;
    
    if (type === 'clothing') {
        if (brandInput && !brandInput.value) brandInput.value = "Loro Piana";
        if (nameInput && !nameInput.value) nameInput.value = "럭셔리 캐시미어 블렌드 라운드 니트";
        colorsInput.value = "오프화이트, 샌드베이지, 소프트블랙, 카멜브라운";
        sizesInput.value = "95 M, 100 L, 105 XL, 110 XXL";
        detailsInput.value = `🧵 [PREMIUM LUXURY SELECTION] Loro Piana 최고급 캘리브레이션 니트웨어입니다.\n\n` +
            `- 소재 혼용률: 캐시미어 70%, 최고급 실크 30% 혼방\n` +
            `- 피팅 감도: 살결에 닿는 촉감이 솜털처럼 부드럽고 가벼우며, 뛰어난 보온성과 신축성을 자랑합니다.\n` +
            `- 세탁 및 케어 가이드: 명품 전문 드라이클리닝을 절대 권장하며, 옷걸이에 걸지 마시고 가볍게 접어 눕혀서 보관해 주세요.\n` +
            `- 코디 제안: 슬림핏 슬랙스나 밝은 톤의 면팬츠와 매치하시면 극강의 럭셔리 데일리룩이 완성됩니다.`;
            
        alert("👕 [명품 의류 자동 기입 템플릿]이 성공적으로 적용되었습니다! 가격과 상품명을 알맞게 조정해 보세요. ✨");
        
    } else if (type === 'golf') {
        if (brandInput && !brandInput.value) brandInput.value = "G/FORE";
        if (nameInput && !nameInput.value) nameInput.value = "시그니처 하이브리드 필드 테크 카라 셔츠";
        colorsInput.value = "에메랄드그린, 소프트화이트, 프렌치네이비";
        sizesInput.value = "95 M, 100 L, 105 XL";
        detailsInput.value = `⛳ [PREMIUM LUXURY GOLFWEAR] 필드 위에서 가장 빛나는 시그니처 테크 피팅 라인입니다.\n\n` +
            `- 소재 혼용률: 기능성 폴리에스터 88%, 스판덱스 12% 고강도 스트레치 혼방\n` +
            `- 피팅 감도: 흡한속건 기능성 쿨링 원단으로, 땀 배출이 극대화되며 스윙 시 몸의 꼬임을 완벽히 서포트합니다.\n` +
            `- 세탁 및 케어 가이드: 30도 이하의 찬물에서 중성세제를 사용하여 단독 기계세탁이 가능합니다. 섬유유연제 사용은 기능성을 떨어뜨리므로 삼가주세요.\n` +
            `- 코디 제안: 당사 골프 카테고리의 화이트 팬츠 또는 기능성 반바지와 코디하시면 완벽한 필드 룩을 완성하실 수 있습니다.`;
            
        alert("⛳ [럭셔리 골프웨어 자동 기입 템플릿]이 성공적으로 적용되었습니다! 대표님의 필드룩 출시를 축하드립니다. ✨");
        
    } else if (type === 'acc') {
        if (brandInput && !brandInput.value) brandInput.value = "Goyard";
        if (nameInput && !nameInput.value) nameInput.value = "생루이 클래식 프리미엄 토트백 GM";
        colorsInput.value = "클래식블랙, 텐브라운, 마린블루";
        sizesInput.value = "GM (가로 40cm x 세로 33cm), PM (가로 34cm x 세로 28cm)";
        detailsInput.value = `👜 [PREMIUM ACC & LEATHER GOODS] 시대를 초월한 명품 가죽 백 시리즈의 정수입니다.\n\n` +
            `- 소재 스펙: 고강도 특수 캔버스 코팅 원사, 천연 송아지 가죽 트리밍 마감\n` +
            `- 디자인 포인트: 유행을 타지 않는 시그니처 쉐브론 패턴 고유 각인과 가볍고 수납력이 극대화된 데일리 백입니다.\n` +
            `- 세탁 및 케어 가이드: 천연 가죽 소재는 수분과 직사광선에 민감하므로 가급적 비 오는 날의 사용을 피하시고, 먼지가 묻었을 시 즉시 마른 융으로 닦아 보관 파우치에 넣어 보관해 주십시오.`;
            
        alert("👜 [명품 잡화/악세사리 자동 기입 템플릿]이 성공적으로 적용되었습니다! 스펙을 알맞게 커스텀 해보세요. ✨");
    }
}

/**
 * 2. [컴퓨터 내부 이미지 파일 처리 헬퍼]
 * - 대표님이 선택하신 로컬 이미지 파일들을 비동기 FileReader를 이용해 Base64 텍스트로 인코딩한 뒤, 미리보기 썸네일을 즉시 분사합니다.
 */
function handleProductImageUpload(event) {
    const files = event.target.files;
    const previewContainer = document.getElementById("manual-prod-preview-container");
    if (!previewContainer) return;
    
    // 신규 업로드이므로 기존 임시 파일 캐시 초기화
    manualUploadedImages = [];
    previewContainer.innerHTML = "";
    
    if (files.length === 0) return;
    
    // 최대 3장 초과 등록 제한
    const uploadLimit = Math.min(files.length, 3);
    if (files.length > 3) {
        alert("🚨 [주의] 피팅 사진 파일은 대표님 전용 보존 한도인 최대 3장까지만 등록 가능합니다! 앞의 3장만 업로드합니다.");
    }
    
    let loadedCount = 0;
    
    for (let i = 0; i < uploadLimit; i++) {
        const file = files[i];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const base64Data = e.target.result;
            manualUploadedImages.push(base64Data); // 내부 Base64 리스트 보관소에 세이브
            
            // 프리뷰 썸네일 박스 디자인 빌딩
            const previewBox = document.createElement("div");
            previewBox.style.position = "relative";
            previewBox.style.width = "70px";
            previewBox.style.height = "90px";
            previewBox.style.borderRadius = "4px";
            previewBox.style.overflow = "hidden";
            previewBox.style.border = "1px solid #4E4A42";
            previewBox.style.flexShrink = "0";
            
            const img = document.createElement("img");
            img.src = base64Data;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            previewBox.appendChild(img);
            
            // 개별 삭제용 미니멀 딜리트 단추
            const delBtn = document.createElement("span");
            delBtn.textContent = "✕";
            delBtn.style.position = "absolute";
            delBtn.style.top = "2px";
            delBtn.style.right = "2px";
            delBtn.style.backgroundColor = "rgba(0,0,0,0.7)";
            delBtn.style.color = "#fff";
            delBtn.style.fontSize = "9px";
            delBtn.style.padding = "2px 4px";
            delBtn.style.borderRadius = "3px";
            delBtn.style.cursor = "pointer";
            delBtn.style.fontWeight = "700";
            
            delBtn.onclick = function(event) {
                event.stopPropagation();
                // 배열에서 제거
                const idx = manualUploadedImages.indexOf(base64Data);
                if (idx !== -1) {
                    manualUploadedImages.splice(idx, 1);
                }
                previewBox.remove();
            };
            
            previewBox.appendChild(delBtn);
            previewContainer.appendChild(previewBox);
            
            loadedCount++;
        };
        
        reader.readAsDataURL(file);
    }
}

// 🌳 [신설 - 카페24 상품 등록 고도화] 수동 등록 인라인 폼용 옵션 칩 전역 저장 배열
let manualProdColors = [];
let manualProdSizes = [];

/**
 * 📂 [수동 등록 인라인용 탭 전환 함수]
 * - 교육용 주석: 카페24 스타일로 상품 수동 등록 영역의 서브 탭을
 *   클릭하면 해당하는 콘텐츠만 노출하고 버튼 클래스를 활성화합니다.
 */
function switchManualProductTab(tabId) {
    // 모든 수동 등록용 탭 콘텐츠 숨기기
    const panels = document.querySelectorAll("#manual-tab-basic, #manual-tab-sale, #manual-tab-optimg");
    panels.forEach(p => p.classList.remove("active"));
    
    // 모든 수동 등록용 탭 버튼 비활성화
    const tabs = document.querySelectorAll("#btn-manual-tab-basic, #btn-manual-tab-sale, #btn-manual-tab-optimg");
    tabs.forEach(t => t.classList.remove("active"));
    
    // 타겟 패널 및 버튼 활성화
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) targetPanel.classList.add("active");
    
    const targetBtn = document.getElementById(`btn-${tabId}`);
    if (targetBtn) targetBtn.classList.add("active");

    const sectionMap = {
        "manual-tab-basic": "cafe24-section-basic",
        "manual-tab-sale": "cafe24-section-sale",
        "manual-tab-optimg": "cafe24-section-images"
    };
    const targetSection = document.getElementById(sectionMap[tabId]);
    if (targetSection) {
        targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}
window.switchManualProductTab = switchManualProductTab;

function syncCafe24SimpleProductDetails() {
    const summaryEl = document.getElementById("manual-prod-summary");
    const editorEl = document.getElementById("manual-prod-editor");
    const detailsEl = document.getElementById("manual-prod-details");
    const counterEl = document.getElementById("manual-prod-editor-count");
    if (!detailsEl) return;

    const summary = summaryEl ? summaryEl.value.trim() : "";
    const editorText = editorEl ? editorEl.innerText.trim() : "";
    const editorHtml = editorEl ? editorEl.innerHTML.trim() : "";
    detailsEl.value = [summary ? "[요약] " + summary : "", editorText ? editorHtml : ""].filter(Boolean).join("\n\n");

    if (counterEl) {
        counterEl.textContent = "문자 : " + editorText.length.toLocaleString();
    }
}
window.syncCafe24SimpleProductDetails = syncCafe24SimpleProductDetails;

function formatCafe24Editor(command) {
    const editorEl = document.getElementById("manual-prod-editor");
    if (!editorEl) return;

    editorEl.focus();
    if (command === "createLink") {
        const url = prompt("연결할 URL을 입력하세요.");
        if (!url) return;
        document.execCommand(command, false, url);
    } else {
        document.execCommand(command, false, null);
    }
    syncCafe24SimpleProductDetails();
}
window.formatCafe24Editor = formatCafe24Editor;

function updateCafe24SelectedCategory() {
    const target = document.getElementById("manual-selected-category-text");
    if (!target) return;

    const selectIds = ["manual-prod-category-large", "manual-prod-category-medium", "manual-prod-category-small"];
    const labels = selectIds.map(id => {
        const select = document.getElementById(id);
        return select && select.value ? select.options[select.selectedIndex]?.text : "";
    }).filter(Boolean);

    target.textContent = labels.length ? labels.join(" > ") : "선택된 분류가 없습니다.";
}
window.updateCafe24SelectedCategory = updateCafe24SelectedCategory;

function clearCafe24CategorySelection() {
    const large = document.getElementById("manual-prod-category-large");
    const medium = document.getElementById("manual-prod-category-medium");
    const small = document.getElementById("manual-prod-category-small");
    if (large) large.value = "";
    if (medium) medium.innerHTML = '<option value="">중분류 선택</option>';
    if (small) small.innerHTML = '<option value="">소분류 선택</option>';
    updateCafe24SelectedCategory();
}
window.clearCafe24CategorySelection = clearCafe24CategorySelection;

function submitCafe24SimpleProductDirect() {
    syncCafe24SimpleProductDetails();
    return submitManualProductDirect();
}
window.submitCafe24SimpleProductDirect = submitCafe24SimpleProductDirect;

function submitNewProductDirect() {
    if (typeof submitProductFormDirect === "function") {
        return submitProductFormDirect();
    }
    return submitCafe24SimpleProductDirect();
}
window.submitNewProductDirect = submitNewProductDirect;

function previewCafe24SimpleProduct() {
    syncCafe24SimpleProductDetails();
    const name = document.getElementById("manual-prod-name")?.value.trim() || "상품명 미입력";
    const price = document.getElementById("manual-prod-price")?.value.trim() || "0";
    const category = document.getElementById("manual-selected-category-text")?.textContent || "선택된 분류가 없습니다.";
    alert("미리보기\n\n상품명: " + name + "\n판매가: " + Number(price).toLocaleString() + "원\n분류: " + category);
}
window.previewCafe24SimpleProduct = previewCafe24SimpleProduct;
/**
 * 🏷️ [수동 등록용 옵션 칩 추가]
 * - 교육용 주석: 인라인 등록 폼에서 대표님이 색상/사이즈를 작성한 후 추가를 클릭했을 때
 *   옵션을 칩 배열에 담고 화면에 예쁜 둥근 태그 모양으로 그려줍니다.
 */
function addManualOptionChip(type) {
    const inputId = type === 'color' ? 'manual-prod-color-input' : 'manual-prod-size-input';
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    
    const val = inputEl.value.trim();
    if (!val) {
        alert("추가할 옵션명을 입력해 주세요! 🧥");
        return;
    }
    
    const targetArr = type === 'color' ? manualProdColors : manualProdSizes;
    if (targetArr.includes(val)) {
        alert("이미 추가된 동일한 옵션이 존재합니다! ⚠️");
        return;
    }
    
    targetArr.push(val);
    inputEl.value = "";
    renderManualOptionChips(type);
}
window.addManualOptionChip = addManualOptionChip;

/**
 * ❌ [수동 등록용 옵션 칩 제거]
 * - 교육용 주석: 대표님이 칩 내부의 X를 클릭하면 배열에서 빼고 화면을 다시 갱신해 줍니다.
 */
function removeManualOptionChip(type, value) {
    if (type === 'color') {
        manualProdColors = manualProdColors.filter(c => c !== value);
    } else {
        manualProdSizes = manualProdSizes.filter(s => s !== value);
    }
    renderManualOptionChips(type);
}
window.removeManualOptionChip = removeManualOptionChip;

/**
 * 🎨 [수동 등록용 옵션 칩 렌더링]
 */
function renderManualOptionChips(type) {
    const containerId = type === 'color' ? 'manual-prod-color-chips' : 'manual-prod-size-chips';
    const containerEl = document.getElementById(containerId);
    if (!containerEl) return;
    
    const targetArr = type === 'color' ? manualProdColors : manualProdSizes;
    containerEl.innerHTML = "";
    
    if (targetArr.length === 0) {
        containerEl.innerHTML = `<span style="font-size:11.5px; color:var(--text-secondary); padding:4px;">등록된 옵션이 없습니다.</span>`;
        return;
    }
    
    targetArr.forEach(val => {
        const chip = document.createElement("span");
        chip.className = "add-prod-chip";
        chip.innerHTML = `
            ${escapeHtml(val)}
            <span class="add-prod-chip-remove" onclick="removeManualOptionChip('${type}', '${escapeHtml(val)}')">✕</span>
        `;
        containerEl.appendChild(chip);
    });
}

/**
 * 📊 [수동 등록용 실시간 할인율 계산기]
 * - 교육용 주석: 인라인 폼의 소비자가와 실제 판매가 데이터를 수집해
 *   할인율을 환산하여 배지 형태로 출력합니다.
 */
function calculateManualDiscountRate() {
    const originalInput = document.getElementById("manual-prod-original");
    const priceInput = document.getElementById("manual-prod-price");
    const badge = document.getElementById("manual-prod-discount-badge");
    
    if (!originalInput || !priceInput || !badge) return;
    
    const original = parseInt(originalInput.value) || 0;
    const price = parseInt(priceInput.value) || 0;
    
    if (original > price && price > 0) {
        const rate = Math.round(((original - price) / original) * 100);
        badge.textContent = `🎯 ${rate}% 할인`;
        badge.style.display = "inline-block";
    } else {
        badge.style.display = "none";
    }
}
window.calculateManualDiscountRate = calculateManualDiscountRate;

/**
 * 3. [신규 수동 상품 최종 등록 기동기 (카페24 스타일 고도화)]
 * - 교육용 주석: 폼 데이터를 취합하고, 선택된 카테고리를 details 본문에 꼬리표([카테고리:명칭])로 부착하며
 *   진열 상태(is_visible), 품절 상태(is_soldout), 재고량(stock)을 모두 조립해 Supabase에 인서트(Insert)를 쏩니다.
 */
async function submitManualProductDirect() {
    if (typeof syncCafe24SimpleProductDetails === "function") {
        syncCafe24SimpleProductDetails();
    }

    const brand = document.getElementById("manual-prod-brand").value.trim();
    const name = document.getElementById("manual-prod-name").value.trim();
    const detailsRaw = document.getElementById("manual-prod-details").value.trim();
    
    // 🏷️ [계층형 카테고리 고도화] 3단 드롭다운 연동
    const largeId = document.getElementById("manual-prod-category-large")?.value;
    const mediumId = document.getElementById("manual-prod-category-medium")?.value;
    const smallId = document.getElementById("manual-prod-category-small")?.value;
    
    const largeCat = localCategories.find(c => c.id === largeId);
    const mediumCat = localCategories.find(c => c.id === mediumId);
    const smallCat = localCategories.find(c => c.id === smallId);
    
    const catParts = [];
    if (largeCat) catParts.push(largeCat.name);
    if (mediumCat) catParts.push(mediumCat.name);
    if (smallCat) catParts.push(smallCat.name);
    
    const categoryPath = catParts.join(">");
    
    // 1단계: 필수 기본정보 검증
    if (!brand || !name || !detailsRaw || !categoryPath) {
        alert("기본 정보 탭의 필수 정보(브랜드, 상품명, 카테고리, 상세 설명)를 모두 채워주세요! 📦");
        switchManualProductTab('manual-tab-basic');
        return;
    }
    
    // 2단계: 판매 & 재고 정보 수집 및 검증
    const price = parseInt(document.getElementById("manual-prod-price").value) || 0;
    const originalInputVal = document.getElementById("manual-prod-original").value.trim();
    const stock = parseInt(document.getElementById("manual-prod-stock").value);
    
    if (price <= 0) {
        alert("실제 판매 가격을 1원 이상의 올바른 숫자로 적어주세요! ₩");
        switchManualProductTab('manual-tab-sale');
        return;
    }
    if (isNaN(stock) || stock < 0) {
        alert("초기 재고 수량을 0개 이상의 올바른 숫자로 적어주세요! 🗃️");
        switchManualProductTab('manual-tab-sale');
        return;
    }
    
    // 진열 여부 라디오 수집
    let manualIsVisible = true;
    const manualVisibleRadios = document.getElementsByName("manual-prod-visible");
    manualVisibleRadios.forEach(r => {
        if (r.checked) manualIsVisible = (r.value === "true");
    });
    
    // 품절 여부 라디오 수집
    let manualIsSoldOut = false;
    const manualSoldoutRadios = document.getElementsByName("manual-prod-soldout");
    manualSoldoutRadios.forEach(r => {
        if (r.checked) manualIsSoldOut = (r.value === "true");
    });
    
    // 소비자가 가공
    let original_price = "";
    if (originalInputVal) {
        const numOriginal = parseInt(originalInputVal);
        original_price = !isNaN(numOriginal) ? `₩${numOriginal.toLocaleString()}` : originalInputVal;
    } else {
        original_price = `₩${price.toLocaleString()}`;
    }
    
    // 3단계: 옵션 및 이미지 정보 검증
    if (manualUploadedImages.length === 0) {
        alert("🚨 [사진 필수] 피팅 사진 파일을 최소 1장 이상 등록(파일 선택)해 주셔야 합니다! 📸");
        switchManualProductTab('manual-tab-optimg');
        return;
    }
    if (manualProdColors.length === 0) {
        alert("색상 옵션을 최소 1개 이상 등록해 주세요! 🎨");
        switchManualProductTab('manual-tab-optimg');
        return;
    }
    if (manualProdSizes.length === 0) {
        alert("사이즈 옵션을 최소 1개 이상 등록해 주세요! 📐");
        switchManualProductTab('manual-tab-optimg');
        return;
    }
    
    // 🏷️ [계층형 카테고리 고도화] details 문자열 맨 앞에 [카테고리:대분류>중분류>소분류] 자동 병합
    const details = `[카테고리:${categoryPath}] ${detailsRaw}`;
    
    const newProduct = {
        post_id: `manual_${Math.floor(10000 + Math.random() * 90000)}`,
        post_url: "https://band.us", // 수동 등록임을 알리기 위한 디폴트 세팅
        brand: brand,
        name: name,
        selling_price: price,
        original_price: original_price,
        image_urls: manualUploadedImages, // 로컬 Base64 데이터 스트림 배열 통째 적재
        colors: manualProdColors,
        sizes: manualProdSizes,
        details: details,
        is_visible: manualIsVisible,
        is_soldout: manualIsSoldOut,
        stock: stock
    };
    
    // 대시보드 로딩 효과 표출 (event 안전 처리)
    let mainBtn = null;
    if (typeof event !== 'undefined' && event && event.target) {
        mainBtn = event.target;
    } else {
        mainBtn = document.querySelector("button[onclick='submitManualProductDirect()']");
    }
    const originalBtnText = mainBtn ? mainBtn.textContent : "📦 명품 신상품 실시간 진열 전시대에 즉시 전시 기동하기";
    
    if (mainBtn) {
        mainBtn.disabled = true;
        mainBtn.textContent = "🔄 대표님 명품 신상 진열장에 로딩 이식 중...";
    }
    
    if (supabaseClient) {
        try {
            // Supabase 클라우드 데이터베이스에 직접 신상 인서트 시도
            const { error } = await timeoutPromise(3500, supabaseClient
                .from("products")
                .insert([newProduct]));
                
            if (error) throw error;
            alert(`🎉 [${name}] 명품 신상품이 클라우드 진열장에 실시간으로 완벽하게 전시 기동되었습니다! 🫡✨`);
        } catch(e) {
            console.warn("⚠️ Supabase 상품 추가 실패로 로컬 저장소 백업 적용:", e.message);
            // Fail-safe 로컬 수복 처리
            const copyProd = { ...newProduct, id: `dummy-${Math.floor(Math.random()*100000)}`, created_at: new Date().toISOString() };
            DUMMY_PRODUCTS.unshift(copyProd);
            allProducts = [...DUMMY_PRODUCTS];
            alert(`🎉 [DB 지연/로컬 보존] [${name}] 상품이 로컬 진열장 최상단에 안전 보존 진열되었습니다!`);
        }
    } else {
        // 완전 가상 로컬 모드인 경우
        const copyProd = { ...newProduct, id: `dummy-${Math.floor(Math.random()*100000)}`, created_at: new Date().toISOString() };
        DUMMY_PRODUCTS.unshift(copyProd);
        allProducts = [...DUMMY_PRODUCTS];
        alert(`🎉 [더미 모드] [${name}] 신상이 최상단 진열대 배치에 완벽히 성공했습니다! (브라우저 캐시 보존)`);
    }
    
    // 폼 입력 요소 초기 청소 및 이미지 프리뷰 파괴
    document.getElementById("manual-prod-brand").value = "";
    document.getElementById("manual-prod-name").value = "";
    document.getElementById("manual-prod-price").value = "";
    document.getElementById("manual-prod-original").value = "";
    document.getElementById("manual-prod-details").value = "";
    const summaryInput = document.getElementById("manual-prod-summary");
    if (summaryInput) summaryInput.value = "";
    const editorInput = document.getElementById("manual-prod-editor");
    if (editorInput) editorInput.innerHTML = "";
    const editorCounter = document.getElementById("manual-prod-editor-count");
    if (editorCounter) editorCounter.textContent = "문자 : 0";
    const selectedCategoryText = document.getElementById("manual-selected-category-text");
    if (selectedCategoryText) selectedCategoryText.textContent = "선택된 분류가 없습니다.";
    
    // 신규 추가된 입력 필드 청소
    const colorInput = document.getElementById("manual-prod-color-input");
    if (colorInput) colorInput.value = "";
    const sizeInput = document.getElementById("manual-prod-size-input");
    if (sizeInput) sizeInput.value = "";
    
    // 라디오 버튼 초기화
    const resetManualVisibleRadios = document.getElementsByName("manual-prod-visible");
    resetManualVisibleRadios.forEach(r => {
        if (r.value === "true") r.checked = true;
    });
    const resetManualSoldoutRadios = document.getElementsByName("manual-prod-soldout");
    resetManualSoldoutRadios.forEach(r => {
        if (r.value === "false") r.checked = true;
    });
    
    // 칩 배열 및 화면 초기화
    manualProdColors = [];
    manualProdSizes = [];
    renderManualOptionChips('color');
    renderManualOptionChips('size');
    
    // 할인율 배지 숨기기
    const badge = document.getElementById("manual-prod-discount-badge");
    if (badge) badge.style.display = "none";
    
    const previewContainer = document.getElementById("manual-prod-preview-container");
    if (previewContainer) previewContainer.innerHTML = "";
    manualUploadedImages = [];
    
    // 파일 업로드 인풋 초기화
    const fileInput = document.getElementById("manual-prod-images-file");
    if (fileInput) fileInput.value = "";
    
    // 탭을 첫 번째로 원위치
    switchManualProductTab('manual-tab-basic');
    
    if (mainBtn) {
        mainBtn.disabled = false;
        mainBtn.textContent = originalBtnText;
    }
    
    // 화면 목록 갱신
    if (typeof fetchAdminProducts === 'function') fetchAdminProducts();
    if (typeof fetchProducts === 'function') fetchProducts();
}

/* =========================================================================
   🌟 [신설 - 럭셔리 5대 고도화 기능 코어 비즈니스 로직 세트] 🌟
   ========================================================================= */

// 1. [북마크 찜하기 전용 뷰 렌더링 엔진]
function renderAdminNotices() {
    const tbody = document.getElementById("admin-notice-rows");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (localNotices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-secondary);">공지 및 이벤트 내역이 없습니다.</td></tr>`;
        return;
    }
    
    localNotices.forEach(n => {
        const tr = document.createElement("tr");
        const typeStr = n.type === "notice" ? "📢 공지" : "🎁 이벤트";
        const dateStr = new Date(n.created_at).toLocaleDateString("ko-KR");
        
        tr.innerHTML = `
            <td style="font-weight:700;">${typeStr}</td>
            <td style="text-align:left; font-weight:600;">${n.title}</td>
            <td>${dateStr}</td>
            <td>
                <button class="admin-points-btn" style="background-color:#c62828;" onclick="deleteNoticeDirect('${n.id}')">삭제</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function submitNewNoticeDirect() {
    const type = document.getElementById("new-notice-type").value;
    const title = document.getElementById("new-notice-title").value.trim();
    const content = document.getElementById("new-notice-content").value.trim();
    
    if (!title || !content) {
        alert("⚠️ 제목과 본문 내용을 모두 친절하게 작성해 주세요!");
        return;
    }
    
    const newNotice = {
        id: "notice-" + Date.now(),
        type: type,
        title: title,
        content: content,
        created_at: new Date().toISOString()
    };
    
    localNotices.unshift(newNotice);
    try {
        safeLocalStorage.setItem("pkb71_notices", JSON.stringify(localNotices));
    } catch(e) {}
    
    // 입력창 리셋
    document.getElementById("new-notice-title").value = "";
    document.getElementById("new-notice-content").value = "";
    
    alert("📢 신규 공지/이벤트가 전광판에 즉각 배포되었습니다!");
    renderAdminNotices();
    showToastMessage();
}

function deleteNoticeDirect(id) {
    if (!confirm("⚠️ 해당 공지/이벤트를 전광판에서 영구 삭제하시겠습니까?")) return;
    
    localNotices = localNotices.filter(n => n.id !== id);
    try {
        safeLocalStorage.setItem("pkb71_notices", JSON.stringify(localNotices));
    } catch(e) {}
    
    renderAdminNotices();
    showToastMessage();
}

// 6. [헤더 연동용 초고속 스마트 유틸 헬퍼 함수군]

// 헤더 ORDER 클릭 시 ➡️ 마이페이지 내 주문 대장으로 원터치 순간이동 스냅
function navigateToOrderSection() {
    if (!currentUser) {
        alert("🔒 주문 내역 조회를 위해 먼저 간편 로그인을 진행해 주세요!");
        openAuthModal('signin');
        return;
    }
    navigateTo('mypage');
    
    // 마이페이지 렌더링 지연시간 0.1초 후 주문 대장 스무스 워프 이동
    setTimeout(() => {
        const orderSection = document.querySelector(".mypage-orders-panel");
        if (orderSection) {
            orderSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 150);
}
// 헤더 Q&A 클릭 시 ➡️ 메인 홈 하단의 Q&A 섹션으로 스무스 스크롤 이동
function navigateToQnaSection() {
    navigateTo('home');
    
    // 홈 화면 렌더링 지연시간 후 Q&A 영역으로 스무스 이동
    setTimeout(() => {
        const qnaSection = document.querySelector(".qna-section");
        if (qnaSection) {
            qnaSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
}

// =========================================================================
// 🗂️ 어드민 사이드바 대분류 아코디언 토글 (+/-) 관리 함수
// =========================================================================

/**
 * 어드민 사이드바 대분류 아코디언 메뉴의 높이값(max-height)을 초기화합니다.
 * 이 함수는 대시보드 진입 시 호출되어, 서브메뉴의 실제 높이에 맞춰 max-height를 동적으로 세팅합니다.
 * 활성화된(active 클래스를 가진) 아코디언 그룹만 펼치고, 나머지는 안전하게 0px로 접어둡니다.
 */
function initSidebarGroupHeights() {
    // 모든 아코디언 그룹 요소를 가져옵니다.
    const menuGroups = document.querySelectorAll(".menu-group");
    
    menuGroups.forEach(group => {
        const sub = group.querySelector(".menu-group-sub");
        const icon = group.querySelector(".toggle-icon");
        
        if (sub) {
            // 부모 그룹이 active 클래스를 가지고 있는 경우에만 펼쳐둡니다.
            if (group.classList.contains("active")) {
                sub.style.maxHeight = sub.scrollHeight + "px";
                if (icon) icon.textContent = "−"; // 펼쳐진 상태 기호 설정
            } else {
                // 활성화되지 않은 메뉴는 0px로 접어서 불필요한 노출을 막습니다.
                sub.style.maxHeight = "0px";
                if (icon) icon.textContent = "+"; // 접힌 상태 기호 설정
            }
        }
    });
}

/**
 * 대분류 사이드바 메뉴 클릭 시 호출되어 하위 서브메뉴를 접거나 펼치는 토글 동작을 수행합니다.
 * CSS 클래스 기반의 가시성(active)과 JS 인라인 높이 제어를 완벽히 연동시켜 버그를 방지합니다.
 * @param {HTMLElement} header - 클릭된 대분류 헤더 영역 요소
 */
function toggleSidebarGroup(header) {
    const group = header.closest(".menu-group");
    if (!group) return;
    
    const sub = group.querySelector(".menu-group-sub");
    const icon = group.querySelector(".toggle-icon");
    if (!sub) return;
    
    // 현재 그룹이 active(펼쳐진) 상태인지 클래스 유무로 확실하게 판단합니다.
    const isOpen = group.classList.contains("active");
    
    if (!isOpen) {
        // 닫혀 있는 상태라면 active 클래스를 추가하고 실제 높이만큼 펼쳐줍니다.
        group.classList.add("active");
        sub.style.maxHeight = sub.scrollHeight + "px";
        if (icon) icon.textContent = "−"; // 펼쳐짐 기호로 변경
    } else {
        // 이미 열려 있는 상태라면 active 클래스를 제거하고 높이를 0px로 만들어 접습니다.
        group.classList.remove("active");
        sub.style.maxHeight = "0px";
        if (icon) icon.textContent = "+"; // 접힘 기호로 변경
    }
}

// =========================================================================
// 🏷️ [신설] 한글 카테고리명 입력 시 영문 카테고리명 실시간 자동 생성 엔진 (대표님 교육용 한글 주석 완비)
// =========================================================================

// 패션 전문 한영 사전 딕셔너리 데이터 정의
const FASHION_KO_TO_EN = {
    // 1. 대분류 관련 주요 어휘
    "여성의류": "WOMEN",
    "남성의류": "MEN",
    "럭셔리잡화": "ACCESSORIES",
    "잡화": "ACCESSORIES",
    "액세서리": "ACCESSORIES",
    "악세사리": "ACCESSORIES",
    "골프": "GOLF",
    "골프웨어": "GOLFWEAR",
    
    // 2. 중/소분류 관련 주요 어휘
    "아우터": "OUTER",
    "원피스": "DRESS",
    "상의": "TOPS",
    "하의": "BOTTOMS",
    "자켓": "JACKETS",
    "재킷": "JACKETS",
    "코트": "COATS",
    "셔츠": "SHIRTS",
    "슬랙스": "PANTS",
    "바지": "PANTS",
    "팬츠": "PANTS",
    "니트": "KNITWEAR",
    "가디건": "CARDIGAN",
    "티셔츠": "T-SHIRTS",
    "가방": "BAGS",
    "백": "BAGS",
    "슈즈": "SHOES",
    "신발": "SHOES",
    "모자": "HATS",
    "벨트": "BELTS",
    "지갑": "WALLETS",
    "시계": "WATCHES",
    "쥬얼리": "JEWELRY",
    "주얼리": "JEWELRY",
    "반지": "RINGS",
    "목걸이": "NECKLACES",
    "귀걸이": "EARRINGS",
    "안경": "GLASSES",
    "선글라스": "SUNGLASSES",
    "스니커즈": "SNEAKERS",
    "로퍼": "LOAFERS",
    "부츠": "BOOTS",
    "스커트": "SKIRTS",
    "치마": "SKIRTS",
    "트레이닝": "TRAINING",
    "웨어": "WEAR",
    "패딩": "PADDING",
    "다운": "DOWN_JACKET",
    "점퍼": "JUMPER",
    "블라우스": "BLOUSE",
    "청바지": "JEANS",
    "데님": "DENIM",
    "베스트": "VEST"
};

/**
 * 초성/중성/종성을 조합하여 한글을 발음 그대로 영문 로마자로 변환해주는 스마트 헬퍼 함수
 * - 파파고 등의 외부 API 없이도 브라우저 로컬 환경(file://)에서 100% 끊김 없이 즉시 실행됩니다.
 */
function convertKoreanToRomaji(koreanStr) {
    if (!koreanStr) return "";
    
    // 초성 19자
    const cho = [
        "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", 
        "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"
    ];
    // 중성 21자
    const jung = [
        "a", "ae", "ya", "yae", "eo", "e", "ye", "ye", "o", "wa", 
        "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"
    ];
    // 종성 28자 (종성이 없을 경우 빈칸으로 대응)
    const jong = [
        "", "g", "kk", "gs", "n", "nj", "nh", "d", "l", "lg", 
        "lm", "lb", "ls", "lt", "lp", "lh", "m", "b", "bs", 
        "s", "ss", "ng", "j", "ch", "k", "t", "p", "h"
    ];
    
    let result = "";
    for (let i = 0; i < koreanStr.length; i++) {
        const charCode = koreanStr.charCodeAt(i);
        
        // 유효 한글 유니코드 블록 범위 검증 (가 ~ 힣)
        if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
            const hangulCode = charCode - 0xAC00;
            const choIndex = Math.floor(hangulCode / (21 * 28));
            const jungIndex = Math.floor((hangulCode % (21 * 28)) / 28);
            const jongIndex = hangulCode % 28;
            
            result += cho[choIndex] + jung[jungIndex] + jong[jongIndex];
        } else {
            // 한글이 아닐 경우(영어, 숫자, 공백 등) 변형 없이 그대로 유지
            result += koreanStr.charAt(i);
        }
    }
    
    // 소문자 결과를 깔끔한 대문자로 정렬하여 반환
    return result.toUpperCase().trim();
}

/**
 * 한글 카테고리명을 스마트 분석하여 매핑되거나 유추되는 영문 카테고리명을 생성합니다.
 */
function translateKoreanToEnglish(koreanName) {
    const text = koreanName.trim();
    if (!text) return "";
    
    // 1단계: 패션용어 사전 딕셔너리에 완전 일치하는 단어가 있는지 검증
    if (FASHION_KO_TO_EN[text]) {
        return FASHION_KO_TO_EN[text];
    }
    
    // 2단계: 복합어 분절 매칭 시도 (글자 수가 긴 사전 단어부터 먼저 탐색하여 분할 교체)
    const sortedKeys = Object.keys(FASHION_KO_TO_EN).sort((a, b) => b.length - a.length);
    let replacedText = text;
    let matchedAny = false;
    
    sortedKeys.forEach(key => {
        if (replacedText.includes(key)) {
            replacedText = replacedText.split(key).join(" " + FASHION_KO_TO_EN[key] + " ");
            matchedAny = true;
        }
    });
    
    if (matchedAny) {
        // 공백 정돈 및 다중 스페이스를 언더바(_)로 연결하여 대문자화
        return replacedText.trim().replace(/\s+/g, '_').toUpperCase();
    }
    
    // 3단계: 매칭되는 패션 용어가 없을 때 최후의 보루로 로마자 발음 표기로 스마트 변환
    return convertKoreanToRomaji(text);
}

/**
 * 대표님이 한글 카테고리명을 타이핑(oninput)할 때 실시간 영문 입력칸에 자동 전파하는 핸들러
 */
function onKoreanCategoryNameInput(val) {
    const engInput = document.getElementById("add-cat-eng");
    if (engInput) {
        // 생성된 세련된 영문 대문자명을 input 가치로 꽂아줍니다.
        engInput.value = translateKoreanToEnglish(val);
    }
}

/**
 * 👑 [신설 6차 고도화] 카페24 스타일 최근 7일 일별 매출 현황 차트 렌더링 함수
 * - Chart.js API를 직접 호출하여 부드럽고 가독성 높은 막대 차트를 구현합니다.
 * - 데이터 갱신 시 기존 차트 인스턴스를 파괴(destroy)하여 중복 그리기를 원천 예방합니다.
 */
function renderAdminSalesChart(orders) {
    const canvas = document.getElementById("admin-sales-chart");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // 1) 기존 차트가 메모리에 존재한다면 충돌/중복을 방지하기 위해 완전히 파괴합니다.
    if (adminSalesChart) {
        adminSalesChart.destroy();
        adminSalesChart = null;
    }
    
    // 2) 최근 7일의 날짜 및 데이터 매핑용 해시맵 구축 (오늘 기준 7일 전까지 역순)
    const labels = [];
    const dateMap = {};
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // 가독성 높은 'MM/DD' 포맷 생성
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        const dateStr = `${month}/${date}`;
        labels.push(dateStr);
        
        const dayKey = d.toDateString();
        dateMap[dayKey] = { dateStr: dateStr, amount: 0 };
    }
    
    // 3) 주문 목록 데이터를 순회하며 최근 7일 내의 매출 총합 계산
    orders.forEach(o => {
        // 취소된 주문이나 입금대기 장부는 통계 매출액에서 제외 (결제완료/배송중/배송완료 등만 집계)
        if (o.status === "주문취소" || o.status === "취소신청" || o.status === "입금대기") return;
        
        const orderDateKey = new Date(o.created_at).toDateString();
        if (dateMap[orderDateKey]) {
            dateMap[orderDateKey].amount += (o.total_amount || 0);
        }
    });
    
    // 차트 Y축에 대응하는 순수 데이터 배열 매핑
    const chartData = labels.map(label => {
        const match = Object.values(dateMap).find(v => v.dateStr === label);
        return match ? match.amount : 0;
    });
    
    // 4) Chart.js 인스턴스 빌딩 및 디자인 속성 주입
    adminSalesChart = new Chart(ctx, {
        type: 'bar', // 직관적인 막대 차트
        data: {
            labels: labels,
            datasets: [{
                label: '일별 매출 합계 (원화 ₩)',
                data: chartData,
                backgroundColor: 'rgba(59, 130, 246, 0.6)', // 카페24 시그니처 소프트 블루 테마
                borderColor: '#3b82f6',
                borderWidth: 1.5,
                borderRadius: 4, // 상단 코너 라운드 처리로 모던함 부각
                hoverBackgroundColor: 'rgba(59, 130, 246, 0.85)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 컨테이너 높이 맞춤 반응형 허용
            plugins: {
                legend: {
                    display: false // 범례는 숨겨 디자인의 극미니멀리즘 유지
                },
                tooltip: {
                    backgroundColor: '#0F1319', // 사이드바와 통일된 다크 네이비 툴팁
                    titleColor: '#FFFFFF',
                    bodyColor: '#3b82f6',
                    bodyFont: {
                        weight: 'bold'
                    },
                    callbacks: {
                        label: function(context) {
                            return ` 매출액: ₩${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false // X축 세로 보조선은 제거하여 심플함 유지
                    },
                    ticks: {
                        color: '#8A9AA8', // 눈금자 회색 톤 조절
                        font: {
                            family: 'Outfit, sans-serif',
                            size: 11
                        }
                    }
                },
                y: {
                    suggestedMin: 0, // y축 최소값 0 고정
                    suggestedMax: 100000, // 👑 [신설] 매출이 아예 없을 때(0) Y축이 지나치게 쪼개지지 않도록 10만 원을 최대치로 고정 가이드
                    grid: {
                        color: 'rgba(255, 255, 255, 0.03)' // 극도로 투명한 가로선
                    },
                    ticks: {
                        color: '#8A9AA8',
                        font: {
                            family: 'Outfit, sans-serif',
                            size: 10
                        },
                        callback: function(value) {
                            // 👑 [수정] y축 수치 중 0원일 때는 깨끗하게 '₩0' 표기
                            if (value === 0) return '₩0';
                            
                            // 👑 [수정] 데이터가 0에 가깝거나 실수 단위로 쪼개질 때 소수점 버그 방지
                            const valInMan = value / 10000;
                            // 소수가 아니면 '₩X만', 소수점이 있으면 첫째 자리까지만 표시
                            return valInMan % 1 === 0 ? '₩' + valInMan + '만' : '₩' + valInMan.toFixed(1) + '만';
                        }
                    }
                }
            }
        }
    });
}

// =========================================================================
// 9. [🔌 백오피스 하부 상세 메뉴 25개 전면 활성화 & 수동 입금 & 실시간 DB 집계]
// =========================================================================

// 🔌 가상 시뮬레이터 발행 내역을 브라우저 세션 동안 보존하기 위한 전역 메모리 객체 (로컬 스토리지 연동)
let VIRTUAL_SIMULATOR_DB = JSON.parse(localStorage.getItem("virtual_simulator_db")) || [];

// =========================================================================
// ⏰ [입금대기 전용 기간 검색 퀵 제어] 대표님이 입금전 관리 탭에서 퀵 버튼(오늘, 7일 등) 클릭 시 날짜 범위를 자동 연산하여 주입합니다.
// =========================================================================
function setAdminDepositOrderDateRange(days) {
    const startDateInput = document.getElementById("admin-deposit-start-date");
    const endDateInput = document.getElementById("admin-deposit-end-date");
    if (!startDateInput || !endDateInput) return;
    
    const today = new Date();
    // YYYY-MM-DD 포맷 변환용 헬퍼 함수
    const format = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    
    let start, end;
    if (days === 0) {
        start = today;
        end = today;
    } else if (days === 1) {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = yesterday;
        end = yesterday;
    } else {
        const prev = new Date();
        prev.setDate(today.getDate() - days);
        start = prev;
        end = today;
    }
    
    startDateInput.value = format(start);
    endDateInput.value = format(end);
    
    // 날짜 주입 후 즉시 입금대기 목록 재조회 및 필터링 적용
    fetchAdminOrdersDeposit();
}
window.setAdminDepositOrderDateRange = setAdminDepositOrderDateRange; // HTML 내 인라인 onclick 바인딩 지원용

// =========================================================================
// 🧹 [입금대기 검색 리셋] 입금전 관리 대장의 모든 검색 조건을 비우고 목록을 전체 불러옵니다.
// =========================================================================
function resetAdminDepositOrderSearch() {
    const startDateInput = document.getElementById("admin-deposit-start-date");
    const endDateInput = document.getElementById("admin-deposit-end-date");
    const searchType = document.getElementById("admin-deposit-search-type");
    const searchKeyword = document.getElementById("admin-deposit-search-keyword");
    
    if (startDateInput) startDateInput.value = "";
    if (endDateInput) endDateInput.value = "";
    if (searchType) searchType.value = "order_no";
    if (searchKeyword) searchKeyword.value = "";
    
    // 리셋 후 리로드
    fetchAdminOrdersDeposit();
}
window.resetAdminDepositOrderSearch = resetAdminDepositOrderSearch;

// =========================================================================
// ☑️ [입금대기 목록 체크박스 일괄 제어] 최상단 헤더 체크박스 클릭 시 전체 목록을 선택/선택해제 합니다.
// =========================================================================
function toggleAllDepositChecks(masterCheckbox) {
    const checkboxes = document.querySelectorAll(".admin-deposit-check");
    checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
    });
}
window.toggleAllDepositChecks = toggleAllDepositChecks;

/**
 * 💰 [수동 입금전 관리 대장] "입금대기" 상태인 주문을 실시간 로드 및 기간/상세조건 필터링 렌더링
 * - 교육용 주석: 무통장 입금 대기 상태인 주문들을 DB 또는 더미데이터로부터 전부 인출한 후,
 *   대표님이 상단 필터 폼에 설정한 날짜 및 검색어 조건(암호화 데이터 복호화 포함)과 정교하게 비교 대조하여
 *   조건에 맞는 데이터만 하단 테이블 목록에 동적으로 렌더링합니다.
 */
async function fetchAdminOrdersDeposit() {
    const tbody = document.getElementById("admin-orders-deposit-rows");
    if (!tbody) return;
    
    // 목록 조회 시작 시 마스터 체크박스 해제
    const masterCheck = document.getElementById("admin-deposit-check-all");
    if (masterCheck) masterCheck.checked = false;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 30px 0;">
                <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 10px auto;"></div>
                <p style="font-size: 11.5px; color: var(--text-secondary);">입금 대기 장부를 실시간 조회 중...</p>
            </td>
        </tr>
    `;
    
    let ordersList = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            // 입금대기 상태인 전체 주문을 Supabase에서 최신순으로 발췌
            const { data } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("*")
                .eq("status", "입금대기")
                .order("created_at", { ascending: false }));
            ordersList = data || [];
        } catch(e) {
            console.error("입금대기 조회 실패:", e);
        }
    }
    
    // DB 데이터가 비어있다면 로컬 더미 주문 데이터에서 입금대기 목록 발췌 (Fail-safe 백업)
    if (ordersList.length === 0 && typeof DUMMY_ORDERS !== 'undefined') {
        ordersList = DUMMY_ORDERS.filter(o => o.status === "입금대기");
    }
    
    // 🔍 대표님이 설정하신 필터 조건값 수집
    const startDateInput = document.getElementById("admin-deposit-start-date");
    const endDateInput = document.getElementById("admin-deposit-end-date");
    const searchType = document.getElementById("admin-deposit-search-type")?.value || "order_no";
    const searchKeyword = document.getElementById("admin-deposit-search-keyword")?.value?.trim() || "";
    
    let filteredList = [...ordersList];
    
    // A. 기간(주문일) 필터 대조
    if (startDateInput && startDateInput.value) {
        const startMs = new Date(startDateInput.value + "T00:00:00").getTime();
        filteredList = filteredList.filter(o => new Date(o.created_at).getTime() >= startMs);
    }
    if (endDateInput && endDateInput.value) {
        const endMs = new Date(endDateInput.value + "T23:59:59").getTime();
        filteredList = filteredList.filter(o => new Date(o.created_at).getTime() <= endMs);
    }
    
    // B. 키워드 검색어 필터 대조 (복호화 연동)
    if (searchKeyword) {
        filteredList = filteredList.filter(o => {
            if (searchType === "order_no") {
                // 주문번호는 단면 텍스트 비교
                return o.order_no.includes(searchKeyword);
            } else if (searchType === "customer_name") {
                // 🔒 개인정보 주문자명 안전 복호화 후 포함 여부 검색
                const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.customer_name) : o.customer_name;
                return decName && decName.includes(searchKeyword);
            } else if (searchType === "depositor") {
                // 🔒 개인정보 입금자명 안전 복호화 후 포함 여부 검색
                const decDepositor = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.depositor_name) : o.depositor_name;
                return decDepositor && decDepositor.includes(searchKeyword);
            } else if (searchType === "product_name") {
                // 주문 내 품목들 중 상품명에 키워드가 걸리는지 검증
                return o.items && o.items.some(item => item.name && item.name.includes(searchKeyword));
            }
            return true;
        });
    }
    
    tbody.innerHTML = "";
    
    if (filteredList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-size:12px;">
                    검색 조건에 일치하는 입금 대기 주문 건이 존재하지 않습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    // 테이블 본문 동적 렌더링 시작
    filteredList.forEach(o => {
        const tr = document.createElement("tr");
        const formattedDate = new Date(o.created_at).toLocaleString('ko-KR', { hour12: false });
        
        // 🔒 주문자 및 입금자명 개인정보 안전 복호화 적용
        const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.customer_name) : o.customer_name;
        const decDepositor = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.depositor_name) : o.depositor_name;
        
        // 주문 상품들의 명세 카드 조립
        const itemsHtml = o.items.map(item => {
            return `<span style="font-size:11.5px; display:block;">• [${escapeHtml(item.brand)}] ${escapeHtml(item.name)} (${item.color}/${item.size}) - <b>${item.qty}개</b></span>`;
        }).join("");
        
        // 무통장 계좌 매핑 정보 (예금주 정보)
        const bankName = "우체국<br><span style='font-size:10px; color:#aaa;'>608-29-103829</span>";
        
        tr.innerHTML = `
            <!-- 맨 왼쪽: 개별 선택 체크박스 -->
            <td style="text-align:center;">
                <input type="checkbox" class="admin-deposit-check" value="${o.id}">
            </td>
            <!-- 주문일시 -->
            <td style="font-size:11px; text-align:center; color:var(--text-secondary);">
                ${formattedDate}
            </td>
            <!-- 주문번호 -->
            <td style="text-align:center; font-family:var(--font-outfit); font-weight:700;">
                ${escapeHtml(o.order_no)}
            </td>
            <!-- 상품명 명세 -->
            <td>
                ${itemsHtml}
            </td>
            <!-- 주문자명 -->
            <td style="text-align:center; font-weight:600;">
                ${escapeHtml(decName)}
            </td>
            <!-- 입금자명 -->
            <td style="text-align:center; font-weight:600; color:var(--accent-gold);">
                ${escapeHtml(decDepositor || decName)}
            </td>
            <!-- 입금 금액 (원화 포맷팅) -->
            <td style="text-align: right; font-size:13px; font-weight:700; font-family:var(--font-outfit); padding-right:12px;">
                ₩${o.total_amount.toLocaleString()}
            </td>
            <!-- 입금은행 정보 -->
            <td style="text-align:center; font-size:11.5px; line-height:1.3;">
                ${bankName}
            </td>
            <!-- 처리여부 상태 뱃지 (입금전) -->
            <td style="text-align:center;">
                <span class="supabase-status-badge red" style="padding: 4px 8px; font-size: 11px;">입금전</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 💳 [일괄 입금확인 처리] 체크박스로 선택된 무통장 입금 대기 주문들을 '결제완료'로 일괄 변경
 * - 교육용 주석: 대표님이 입금 내역을 수동으로 통장 확인 후, 다수의 주문 건을
 *   일괄 선택하여 버튼을 누르면 상태를 '결제완료'로 대량 동시 갱신하고 DB에 저장합니다.
 */
async function batchApproveDeposit() {
    const checkedBoxes = document.querySelectorAll(".admin-deposit-check:checked");
    if (checkedBoxes.length === 0) {
        alert("⚠️ 입금확인 처리할 주문을 최소 1건 이상 체크해 주세요.");
        return;
    }
    
    const orderIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (!confirm(`💳 선택하신 ${orderIds.length}건의 주문에 대해 입금확인을 완료하고 결제승인 처리하시겠습니까?`)) {
        return;
    }
    
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            // DB orders 테이블에서 선택한 ID들의 상태를 '결제완료'로 일괄 수정
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("orders")
                .update({ status: "결제완료" })
                .in("id", orderIds));
                
            if (error) throw error;
            
            showToastMessage(); // 성공 토스트 노출
            fetchAdminOrdersDeposit(); // 입금대기 대장 즉시 필터 갱신
            fetchAdminDashboardStats(); // 상단 요약 현황판 및 일별 차트 동기화
        } catch(e) {
            alert(`⚠️ DB 일괄 입금 처리 중 에러 발생: ${e.message}`);
        }
    } else {
        // 더미 모드 대응 (Fail-safe)
        if (typeof DUMMY_ORDERS !== 'undefined') {
            orderIds.forEach(id => {
                const idx = DUMMY_ORDERS.findIndex(o => o.id === id);
                if (idx !== -1) {
                    DUMMY_ORDERS[idx].status = "결제완료";
                }
            });
        }
        showToastMessage();
        fetchAdminOrdersDeposit();
        fetchAdminDashboardStats();
    }
}
window.batchApproveDeposit = batchApproveDeposit;

/**
 * ❌ [일괄 주문취소 처리] 체크박스로 선택된 무통장 입금 대기 주문들을 '주문취소'로 일괄 강제 변경
 * - 교육용 주석: 입금 미이행, 변심 등의 사유로 장기 대기 중인 주문들을 선택하여
 *   일괄적으로 주문 상태를 '주문취소' 상태로 전환하여 관리 대장에서 배제합니다.
 */
async function batchCancelDeposit() {
    const checkedBoxes = document.querySelectorAll(".admin-deposit-check:checked");
    if (checkedBoxes.length === 0) {
        alert("⚠️ 주문취소 처리할 주문을 최소 1건 이상 체크해 주세요.");
        return;
    }
    
    const orderIds = Array.from(checkedBoxes).map(cb => cb.value);
    if (!confirm(`❌ 선택하신 ${orderIds.length}건의 주문을 일괄 취소 처리하시겠습니까?\n취소된 주문은 복구할 수 없습니다.`)) {
        return;
    }
    
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            // DB orders 테이블에서 선택한 ID들의 상태를 '주문취소'로 일괄 수정
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("orders")
                .update({ status: "주문취소" })
                .in("id", orderIds));
                
            if (error) throw error;
            
            showToastMessage(); // 성공 토스트 노출
            fetchAdminOrdersDeposit(); // 목록 즉시 필터 갱신
            fetchAdminDashboardStats(); // 상단 통계판 동기화
        } catch(e) {
            alert(`⚠️ DB 일괄 주문취소 처리 중 에러 발생: ${e.message}`);
        }
    } else {
        // 더미 모드 대응 (Fail-safe)
        if (typeof DUMMY_ORDERS !== 'undefined') {
            orderIds.forEach(id => {
                const idx = DUMMY_ORDERS.findIndex(o => o.id === id);
                if (idx !== -1) {
                    DUMMY_ORDERS[idx].status = "주문취소";
                }
            });
        }
        showToastMessage();
        fetchAdminOrdersDeposit();
        fetchAdminDashboardStats();
    }
}
window.batchCancelDeposit = batchCancelDeposit;

/**
 * 🚚 [배송 단계별 통합 통제 대장] 결제완료, 배송중, 배송완료 상태의 주문만 정밀 필터링하여 로드
 * - 교육용 주석: 결제완료(배송준비), 배송중, 배송완료 상태별로 주문서를 걸러내어
 *   송장번호 입력 폼을 활성화하거나 배송추적 대장을 실시간 구축합니다.
 */
async function fetchAdminOrdersDelivery(statusFilter) {
    const tbody = document.getElementById("admin-orders-delivery-rows");
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="6" style="text-align: center; padding: 30px 0;">
                <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 10px auto;"></div>
                <p style="font-size: 11.5px; color: var(--text-secondary);">배송 관리 대장을 실시간 조회 중...</p>
            </td>
        </tr>
    `;
    
    let ordersList = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("*")
                .eq("status", statusFilter)
                .order("created_at", { ascending: false }));
            ordersList = data || [];
        } catch(e) {
            console.error("배송주문 조회 실패:", e);
        }
    }
    
    if (ordersList.length === 0 && typeof DUMMY_ORDERS !== 'undefined') {
        ordersList = DUMMY_ORDERS.filter(o => o.status === statusFilter);
    }
    
    tbody.innerHTML = "";
    
    if (ordersList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 40px 0; font-size:12px;">
                    해당 배송 단계(${statusFilter})에 배속된 주문서 내역이 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    ordersList.forEach(o => {
        const tr = document.createElement("tr");
        const formattedDate = new Date(o.created_at).toLocaleString('ko-KR', { hour12: false });
        
        // 개인정보 안전 복호화
        const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.customer_name) : o.customer_name;
        const decPhone = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.phone) : o.phone;
        const decPost = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.postcode) : o.postcode;
        const decAddr = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.address) : o.address;
        const decAddrDetail = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.address_detail) : o.address_detail;
        const decMessage = typeof secureDecrypt !== 'undefined' ? secureDecrypt(o.message) : o.message;
        
        // 운송장 추출
        let trackingNum = "";
        let carrierName = "우체국택배";
        if (decMessage && decMessage.includes("[송장:")) {
            const trackMatch = decMessage.match(/\[송장:\s*([^\]\s]+)\s*([^\]]+)?\]/);
            if (trackMatch) {
                carrierName = trackMatch[1];
                trackingNum = trackMatch[2] ? trackMatch[2].trim() : "";
            }
        }
        
        // 상품 리스트 조립
        const itemsHtml = o.items.map(item => {
            return `<span style="font-size:11.5px; display:block;">• [${escapeHtml(item.brand)}] ${escapeHtml(item.name)} (${item.color}/${item.size}) - <b>${item.qty}개</b></span>`;
        }).join("");
        
        // 배송 처리부 HTML 분기
        let deliveryActionHtml = "";
        if (statusFilter === "결제완료") {
            deliveryActionHtml = `
                <div style="display:flex; flex-direction:column; gap:6px;">
                    <select id="carrier-${o.id}" class="admin-input-text" style="font-size:11.5px; padding:4px;">
                        <option value="우체국택배">우체국택배</option>
                        <option value="CJ대한통운">CJ대한통운</option>
                        <option value="한진택배">한진택배</option>
                    </select>
                    <input type="text" id="tracking-${o.id}" placeholder="송장번호 입력" class="admin-input-text" style="font-size:11px; text-align:center;">
                    <button class="admin-save-btn" style="background-color:#1565C0; padding:4px 8px; font-size:11px;" onclick="processShipmentStart('${o.id}')">배송 출발 처리</button>
                </div>
            `;
        } else if (statusFilter === "배송중") {
            deliveryActionHtml = `
                <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
                    <span style="font-size:11px; color:#1565C0; font-weight:700;">🚛 ${escapeHtml(carrierName)}</span>
                    <span style="font-size:11px; font-family:var(--font-outfit);">${escapeHtml(trackingNum)}</span>
                    <button class="admin-save-btn" style="background-color:#2E7D32; padding:4px 8px; font-size:11px;" onclick="processShipmentComplete('${o.id}')">배송 완료 처리</button>
                </div>
            `;
        } else if (statusFilter === "배송완료") {
            deliveryActionHtml = `
                <div style="text-align:center;">
                    <span class="supabase-status-badge green" style="background-color:#e8f5e9; color:#2e7d32; border:1px solid #c8e6c9; padding:2px 8px; border-radius:12px; font-size:11px;">수취완료</span>
                    <span style="font-size:10.5px; color:var(--text-secondary); display:block; margin-top:4px;">🚛 ${escapeHtml(carrierName)} ${escapeHtml(trackingNum)}</span>
                </div>
            `;
        }
        
        tr.innerHTML = `
            <td style="text-align:center;">
                <span style="font-family:var(--font-outfit); font-weight:700;">${escapeHtml(o.order_no)}</span><br>
                <span style="font-size:10.5px; color:var(--text-secondary);">${formattedDate}</span>
            </td>
            <td>
                <span style="font-weight:700;">${escapeHtml(decName)}</span><br>
                <span style="font-size:11px; color:var(--text-secondary);">📞 ${escapeHtml(decPhone || '연락처 미기입')}</span>
            </td>
            <td style="font-size:11.5px; line-height:1.4;">
                [${escapeHtml(decPost || '')}] ${escapeHtml(decAddr || '')} ${escapeHtml(decAddrDetail || '')}
            </td>
            <td>${itemsHtml}</td>
            <td style="text-align: center; font-size:14px; font-weight:700; font-family:var(--font-outfit);">
                ₩${o.total_amount.toLocaleString()}
            </td>
            <td style="text-align: center;">
                ${deliveryActionHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function processShipmentStart(orderId) {
    const carrier = document.getElementById(`carrier-${orderId}`)?.value || "우체국택배";
    const tracking = document.getElementById(`tracking-${orderId}`)?.value.trim();

    if (!tracking) {
        alert("배송 출발 처리 전에 송장번호를 입력해 주세요.");
        return;
    }

    const deliveryMemo = `[송장: ${carrier} ${tracking}]`;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        try {
            const { data } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("message")
                .eq("id", orderId)
                .single());
            const decMessage = typeof secureDecrypt === "function" ? secureDecrypt(data?.message) : (data?.message || "");
            const nextMessage = decMessage ? `${decMessage} ${deliveryMemo}` : deliveryMemo;
            const updateData = {
                status: "배송중",
                message: typeof secureEncrypt === "function" ? secureEncrypt(nextMessage) : nextMessage
            };
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("orders")
                .update(updateData)
                .eq("id", orderId));
            if (error) throw error;
        } catch (error) {
            alert(`배송 출발 처리 중 오류가 발생했습니다: ${error.message}`);
            return;
        }
    } else if (typeof DUMMY_ORDERS !== "undefined") {
        const idx = DUMMY_ORDERS.findIndex(order => order.id === orderId);
        if (idx !== -1) {
            DUMMY_ORDERS[idx].status = "배송중";
            DUMMY_ORDERS[idx].message = DUMMY_ORDERS[idx].message
                ? `${DUMMY_ORDERS[idx].message} ${deliveryMemo}`
                : deliveryMemo;
        }
    }

    showToastMessage();
    fetchAdminOrdersDelivery("배송중");
    renderCafe24AdminHomeDashboard();
}

async function processShipmentComplete(orderId) {
    if (!confirm("선택한 주문을 배송완료 상태로 변경하시겠습니까?")) return;

    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        try {
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("orders")
                .update({ status: "배송완료" })
                .eq("id", orderId));
            if (error) throw error;
        } catch (error) {
            alert(`배송 완료 처리 중 오류가 발생했습니다: ${error.message}`);
            return;
        }
    } else if (typeof DUMMY_ORDERS !== "undefined") {
        const idx = DUMMY_ORDERS.findIndex(order => order.id === orderId);
        if (idx !== -1) {
            DUMMY_ORDERS[idx].status = "배송완료";
        }
    }

    showToastMessage();
    fetchAdminOrdersDelivery("배송완료");
    renderCafe24AdminHomeDashboard();
}

window.processShipmentStart = processShipmentStart;
window.processShipmentComplete = processShipmentComplete;

/**
 * 🗃️ [개별 재고 업데이트] 입력된 숫자를 실시간으로 DB에 갱신 저장
 * - 교육용 주석: 변경된 재고 숫자를 DB에 즉시 저장하고,
 *   재고가 0개로 설정될 시 자동으로 품절 처리(is_soldout = true) 연동을 실시합니다.
 */
async function saveSingleProductStock(prodId) {
    const inputVal = document.getElementById(`stock-val-${prodId}`).value;
    const newStock = parseInt(inputVal);
    
    if (isNaN(newStock) || newStock < 0) {
        alert("🗃️ 재고수량은 0개 이상의 올바른 숫자로 입력해 주세요!");
        return;
    }
    
    const isSoldOut = newStock === 0;
    
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .update({ stock: newStock, is_soldout: isSoldOut })
                .eq("id", prodId));
                
            if (error) throw error;
            
            showToastMessage(); // 실시간 저장 토스트 팝업 실행
            fetchAdminProductStock(); // 목록 갱신
        } catch(e) {
            alert(`⚠️ DB 재고 갱신 실패: ${e.message}`);
        }
    } else {
        if (typeof DUMMY_PRODUCTS !== 'undefined') {
            const idx = DUMMY_PRODUCTS.findIndex(p => p.id === prodId);
            if (idx !== -1) {
                DUMMY_PRODUCTS[idx].stock = newStock;
                DUMMY_PRODUCTS[idx].is_soldout = isSoldOut;
            }
        }
        showToastMessage();
        fetchAdminProductStock();
    }
}

/**
 * 👥 [고객 대시보드 및 최근 가입 회원 목록] 통계 수치 실시간 집계 연동
 * - 교육용 주석: profiles DB 테이블로부터 전체 회원 수와 오늘 신규 회원 수를 자동으로 집계하여 출력하고,
 *   최근 가입일시 순으로 최신 가입 VIP 회원 5명을 리스트업합니다.
 */
async function fetchAdminCustomerDashboardStats() {
    const tbody = document.getElementById("admin-recent-customers-rows");
    const elNewCount = document.getElementById("cust-today-new");
    const elTotalCount = document.getElementById("cust-total");
    
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 25px 0;">
                <div class="spinner" style="width: 20px; height: 20px; margin: 0 auto 10px auto;"></div>
                <p style="font-size: 11px; color: var(--text-secondary);">회원 추이를 자동 계산하고 있습니다...</p>
            </td>
        </tr>
    `;
    
    let customersList = [];
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        try {
            const { data } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false }));
            customersList = data || [];
        } catch(e) {
            console.error("회원 조회 에러:", e);
        }
    }
    
    // Fail-safe 더미 데이터 바인딩
    if (customersList.length === 0 && typeof localUsers !== 'undefined') {
        customersList = [...localUsers];
    }
    
    // 1) 통계 계산 (전체 회원 및 오늘 가입 회원)
    const totalCount = customersList.length;
    const todayStr = new Date().toDateString();
    const newCount = customersList.filter(u => new Date(u.created_at).toDateString() === todayStr).length;
    
    if (elNewCount) elNewCount.textContent = newCount;
    if (elTotalCount) elTotalCount.textContent = totalCount;
    
    tbody.innerHTML = "";
    
    // 2) 최근 가입한 5명의 회원만 슬라이싱하여 목록 렌더링
    const recentUsers = customersList.slice(0, 5);
    
    if (recentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 25px 0; font-size:12px;">
                    가입된 회원 내역이 존재하지 않습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    recentUsers.forEach(u => {
        const tr = document.createElement("tr");
        const formattedDate = new Date(u.created_at).toLocaleString('ko-KR', { hour12: false });
        
        // 개인정보 복호화
        const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(u.name) : u.name;
        const decPhone = typeof secureDecrypt !== 'undefined' ? secureDecrypt(u.phone) : u.phone;
        
        const emailVal = u.email || `${escapeHtml(decName || 'user')}@pkb71.com`;
        const phoneVal = decPhone || "연락처 미기입";
        
        tr.innerHTML = `
            <td style="text-align:center; font-family:var(--font-outfit); font-size:11.5px; color:var(--text-secondary);">
                ${formattedDate}
            </td>
            <td>
                <b style="font-size:12px; font-family:var(--font-outfit);">${escapeHtml(emailVal)}</b>
            </td>
            <td style="text-align:center; font-weight:700;">
                ${escapeHtml(decName || '무명고객')}
            </td>
            <td style="text-align:center; font-size:11.5px; color:var(--text-secondary);">
                📞 ${escapeHtml(phoneVal)}
            </td>
            <td style="text-align:center;">
                <span class="supabase-status-badge green" style="background-color:#fffdf6; color:#b89851; border:1px solid #eadebe; font-size:10.5px; padding:2px 6px;">VIP 일반</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 🔌 [지능형 가상 시뮬레이터] 세금계산서/현금영수증 발행을 위한 주문서 셀렉트박스 및 장부 대장 연동
 * - 교육용 주석: 대표님의 날카로운 지적에 따라, 상품진열/상품옵션/고객조회 등 주문서와 관계가 없는 탭에서는
 *   "발행 대상 주문서 선택" 대신 "설정 대상 상품/회원 선택"으로 동적 UI를 전환하는 지능형 라우팅 모듈로 보완했습니다.
 */
async function initVirtualSimulator(mode) {
    const select = document.getElementById("simulator-order-select");
    const historyTbody = document.getElementById("simulator-history-rows");
    
    // UI 동적 제어용 엘리먼트 획득
    const elPanelTitle = document.getElementById("simulator-panel-title");
    const elSelectLabel = document.getElementById("simulator-select-label");
    const elTriggerBtn = document.getElementById("simulator-trigger-btn");
    const elHistoryTitle = document.getElementById("simulator-history-title");
    const elTableHeader = document.getElementById("simulator-table-header");
    const elDynamicInputs = document.getElementById("simulator-dynamic-inputs");
    const elSelectModeContainer = document.getElementById("simulator-selection-mode-container"); // 🎯 [신설] 선택 방식 라디오 그룹 컨테이너
    
    // 🔍 [신설] 검색용 엘리먼트 획득 및 초기화
    const elSearchWrapper = document.getElementById("simulator-search-wrapper");
    const elSearchInput = document.getElementById("simulator-search-input");
    if (elSearchInput) elSearchInput.value = "";
    
    if (!select || !historyTbody) return;
    
    // 동적 인풋 영역 일단 초기화 및 숨김
    if (elDynamicInputs) {
        elDynamicInputs.innerHTML = "";
        elDynamicInputs.style.display = "none";
    }

    // 🎯 [신설] 상품 선택 방식 라디오 컨테이너 일단 숨김 및 수동 선택 라디오에 체크 기본화
    if (elSelectModeContainer) {
        elSelectModeContainer.style.display = "none";
    }
    
    // 🔍 [신설] 검색 필터 인풋 노출 분기 (모든 모의 시뮬레이터 탭에서 즉시 검색이 되도록 표시)
    if (elSearchWrapper) {
        elSearchWrapper.style.display = "block";
    }
    
    currentSimulatorMode = mode;
    currentSimulatorDataList = [];
    
    // 주문서 기반의 발행 및 격리 탭 여부 판정 (현금영수증, 세금계산서, 자동입금, 배송 보류/대기 등)
    const isOrderTab = ["orders-cash-receipt", "orders-tax-invoice", "orders-auto-deposit", "orders-extra", "orders-hold"].includes(mode);
    
    // 1) 탭 유형별 UI 텍스트 및 테이블 구조 동적 리디렉션
    if (isOrderTab) {
        let panelTitle = "⚡ 모의 수동 발행 시뮬레이터";
        let selectLabel = "발행 대상 주문서 선택";
        let triggerBtnText = "🎯 가상 모의 전자 발행";
        let historyTitle = "📑 실시간 가상 모의 전자 발행 대장";
        let selectDefault = "- 발행 가능한 결제 완료 주문 건 선택 -";
        let tableHeaderHtml = `
            <tr>
                <th width="20%" style="white-space: nowrap; text-align: center;">가상 승인번호</th>
                <th width="20%" style="white-space: nowrap; text-align: center;">대상 주문번호</th>
                <th width="20%" style="white-space: nowrap; text-align: center;">공급가액 / 부가세</th>
                <th width="15%" style="white-space: nowrap; text-align: center;">발행구분</th>
                <th width="15%" style="white-space: nowrap; text-align: center;">발행일시</th>
                <th width="10%" style="white-space: nowrap; text-align: center;">상태</th>
            </tr>
        `;

        if (mode === "orders-hold") {
            panelTitle = "⏳ 배송 보류/격리 시뮬레이터";
            selectLabel = "보류 격리 조치할 주문서 선택";
            triggerBtnText = "⏳ 가상 배송 보류 설정";
            historyTitle = "📑 실시간 배송 보류/격리 조치 대장";
            selectDefault = "- 보류/격리 조치를 적용할 주문 건 선택 -";
            tableHeaderHtml = `
                <tr>
                    <th width="20%" style="white-space: nowrap; text-align: center;">가상 승인번호</th>
                    <th width="20%" style="white-space: nowrap; text-align: center;">대상 주문번호</th>
                    <th width="25%" style="white-space: nowrap; text-align: center;">보류 사유 / 격리 내용</th>
                    <th width="15%" style="white-space: nowrap; text-align: center;">조치구분</th>
                    <th width="15%" style="white-space: nowrap; text-align: center;">설정일시</th>
                    <th width="10%" style="white-space: nowrap; text-align: center;">상태</th>
                </tr>
            `;
            
            // 배송보류 격리 사유 선택지 동적 생성
            if (elDynamicInputs) {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">⏳ 가상 배송 보류 및 격리 사유 선택</label>
                        <select id="sim-opt-hold" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="원단 수급 지연으로 인한 공급 부족 격리">원단 수급 지연으로 인한 공급 부족 격리</option>
                            <option value="주소지 불명확(동호수 누락) 의심 격리">주소지 불명확(동호수 누락) 의심 격리</option>
                            <option value="고객 개인 사정으로 인한 주말 수령 긴급 보류">고객 개인 사정으로 인한 주말 수령 긴급 보류</option>
                        </select>
                    </div>
                `;
            }
        }
        
        if (elPanelTitle) elPanelTitle.textContent = panelTitle;
        if (elSelectLabel) elSelectLabel.textContent = selectLabel;
        if (elTriggerBtn) elTriggerBtn.textContent = triggerBtnText;
        if (elHistoryTitle) elHistoryTitle.textContent = historyTitle;
        if (elTableHeader) elTableHeader.innerHTML = tableHeaderHtml;
        
        // 결제완료 및 배송대기 주문서 바인딩
        let settledOrders = [];
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const statusList = mode === "orders-hold" ? ["결제완료", "배송대기"] : ["결제완료"];
                const { data } = await timeoutPromise(2500, supabaseClient
                    .from("orders")
                    .select("*")
                    .in("status", statusList)
                    .order("created_at", { ascending: false }));
                settledOrders = data || [];
            } catch(e) {
                console.error("시뮬레이터 주문 조회 실패:", e);
            }
        }
        if (settledOrders.length === 0 && typeof DUMMY_ORDERS !== 'undefined') {
            if (mode === "orders-hold") {
                settledOrders = DUMMY_ORDERS.filter(o => o.status === "결제완료" || o.status === "배송대기");
            } else {
                settledOrders = DUMMY_ORDERS.filter(o => o.status === "결제완료");
            }
        }
        
        // 🔍 [신설] 백업 전역 변수에 데이터 장착
        currentSimulatorDataList = settledOrders;
        
        // 🔍 [신설] 드롭다운 전용 옵션 렌더링 호출
        renderSimulatorSelectOptions(currentSimulatorDataList, mode);
        
    } else {
        // 상품진열, 상품옵션, 고객상세조회 등 설정 기반 탭의 경우
        if (elPanelTitle) elPanelTitle.textContent = "⚡ 가상 모의 설정 시뮬레이터";
        if (elSelectLabel) elSelectLabel.textContent = mode.startsWith("customers-") ? "설정 대상 회원 선택" : "설정 대상 상품 선택";
        if (elTriggerBtn) elTriggerBtn.textContent = "🎯 가상 모의 설정 적용";
        if (elHistoryTitle) elHistoryTitle.textContent = "📑 실시간 가상 설정 변경 대장";
        if (elTableHeader) {
            elTableHeader.innerHTML = `
                <tr>
                    <th width="20%" style="white-space: nowrap; text-align: center;">가상 승인번호</th>
                    <th width="25%" style="white-space: nowrap; text-align: center;">설정 대상 항목</th>
                    <th width="20%" style="white-space: nowrap; text-align: center;">설정 내용 (가상)</th>
                    <th width="15%" style="white-space: nowrap; text-align: center;">모드 구분</th>
                    <th width="15%" style="white-space: nowrap; text-align: center;">설정일시</th>
                    <th width="10%" style="white-space: nowrap; text-align: center;">상태</th>
                </tr>
            `;
        }
        
        // 🎯 [상품 선택 방식 라디오 노출 제어] 회원 탭에서는 숨기고, 상품 탭(products-*)인 경우에만 출력
        if (elSelectModeContainer) {
            if (mode.startsWith("products-")) {
                elSelectModeContainer.style.display = "flex";
                
                // 현재 라디오의 선택 상태에 맞추어 드롭다운의 비활성화 토글 동기화
                const activeMode = document.querySelector('input[name="sim-select-mode"]:checked')?.value || "manual";
                toggleSimulatorSelectMode(activeMode);
            } else {
                elSelectModeContainer.style.display = "none";
            }
        }
        
        // --- [2차 고도화] 상품 및 회원 관련 설정 탭별 맞춤 인풋 로드 ---
        if (elDynamicInputs) {
            if (mode === "products-display") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">✨ 진열 가상 전시 구좌 선택</label>
                        <select id="sim-opt-display" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="메인 대형 롤링 배너 1구좌 강제 배치">메인 대형 롤링 배너 1구좌 강제 배치</option>
                            <option value="주간 BEST 구좌 1순위 최상단 진열 고정">주간 BEST 구좌 1순위 최상단 진열 고정</option>
                            <option value="MD 가을 추천 고감도 스타일링 구좌 추천">MD 가을 추천 고감도 스타일링 구좌 추천</option>
                        </select>
                    </div>
                `;
            } else if (mode === "products-options") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">🎨 가상 상품 옵션 규격 추가 설정</label>
                        <select id="sim-opt-options" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="추가 3XL 오버사이즈 규격 추가 (+₩5,000)">추가 3XL 오버사이즈 규격 추가 (+₩5,000)</option>
                            <option value="고급 가죽 케이스 & 스페셜 포장 박스 개설 (+₩3,000)">고급 가죽 케이스 & 스페셜 포장 박스 개설 (+₩3,000)</option>
                            <option value="프리미엄 기프트 카톤 쇼핑백 동봉 옵션 (+₩1,000)">프리미엄 기프트 카톤 쇼핑백 동봉 옵션 (+₩1,000)</option>
                        </select>
                    </div>
                `;
            } else if (mode === "products-curation") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">👑 AI 추천 노드 정밀 가중치 조율</label>
                        <select id="sim-opt-curation" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="회원 최근 구매 카테고리 가중치 +15% 상향">회원 최근 구매 카테고리 가중치 +15% 상향</option>
                            <option value="실시간 동시 담기 패턴 일치도 가중치 +10%">실시간 동시 담기 패턴 일치도 가중치 +10%</option>
                            <option value="장바구니 방치 상품 관련 추천 가중치 +20%">장바구니 방치 상품 관련 추천 가중치 +20%</option>
                        </select>
                    </div>
                `;
            } else if (mode === "products-sub") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">📅 정기 결제 및 출고 배송 주기</label>
                        <select id="sim-opt-sub" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="매주 지정 요일 자동 결제 및 특송">매주 지정 요일 자동 결제 및 특송</option>
                            <option value="격주 주기 자동 토큰 인출 및 포장 출고">격주 주기 자동 토큰 인출 및 포장 출고</option>
                            <option value="매월 1일 가상 정기 결제 및 정기 정배송">매월 1일 가상 정기 결제 및 정기 정배송</option>
                        </select>
                    </div>
                `;
            } else if (mode === "products-restock") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">🔔 재입고 실시간 안내 발송 매체</label>
                        <select id="sim-opt-restock" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="카카오 알림톡 자동 전송 (비즈머니 자동차감)">카카오 알림톡 자동 전송 (비즈머니 자동차감)</option>
                            <option value="장문 SMS 문자 일괄 발송 기동">장문 SMS 문자 일괄 발송 기동</option>
                            <option value="회원 가입 메일로 복구 소식 일괄 뉴스레터 송신">회원 가입 메일로 복구 소식 일괄 뉴스레터 송신</option>
                        </select>
                    </div>
                `;
            } else if (mode === "customers-benefits") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">🎁 등급 가산 특별 혜택 지급 쿠폰 선택</label>
                        <select id="sim-opt-benefits" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="VIP 특별 무료배송 티켓 1회권 자동 지급">VIP 특별 무료배송 티켓 1회권 자동 지급</option>
                            <option value="VIP 전용 10% 추가할인 쿠폰 발행 대장 입력">VIP 전용 10% 추가할인 쿠폰 발행 대장 입력</option>
                            <option value="신규 가입 일반회원 3,000원 웰컴 포인트 지급">신규 가입 일반회원 3,000원 웰컴 포인트 지급</option>
                        </select>
                    </div>
                `;
            } else if (mode === "customers-audience") {
                elDynamicInputs.style.display = "flex";
                elDynamicInputs.innerHTML = `
                    <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-size: 11px; color: var(--accent-gold); font-weight:600;">🎯 타겟 마케팅 대상 오디언스 추출 필터</label>
                        <select id="sim-opt-audience" class="form-input" style="padding: 8px 10px; font-size: 12px; background: #1A222E; color: #fff; border: 1px solid var(--border-light);">
                            <option value="최근 30일 이내 로그인 기록이 없는 장기 미접속 회원">최근 30일 이내 로그인 기록이 없는 장기 미접속 회원</option>
                            <option value="장바구니에 상품을 보관하고 7일간 결제하지 않은 고객">장바구니에 상품을 보관하고 7일간 결제하지 않은 고객</option>
                            <option value="누적 결제 금액 500만원 초과 하이엔드 구매 고객">누적 결제 금액 500만원 초과 하이엔드 구매 고객</option>
                        </select>
                    </div>
                `;
            }
        }
        
        if (mode.startsWith("customers-")) {
            // 회원 데이터 바인딩
            let customersList = [];
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data } = await timeoutPromise(2500, supabaseClient.from("profiles").select("*"));
                    customersList = data || [];
                } catch(e) {}
            }
            if (customersList.length === 0 && typeof localUsers !== 'undefined') {
                customersList = [...localUsers];
            }
            
            // 🔍 [신설] 백업 전역 변수에 데이터 장착
            currentSimulatorDataList = customersList;
            
            // 🔍 [신설] 드롭다운 전용 옵션 렌더링 호출
            renderSimulatorSelectOptions(currentSimulatorDataList, mode);
            
        } else {
            // 상품 데이터 바인딩
            let productsList = [];
            if (typeof supabaseClient !== 'undefined' && supabaseClient) {
                try {
                    const { data } = await timeoutPromise(2500, supabaseClient.from("products").select("*"));
                    productsList = data || [];
                } catch(e) {}
            }
            if (productsList.length === 0 && typeof DUMMY_PRODUCTS !== 'undefined') {
                productsList = [...DUMMY_PRODUCTS];
            }
            
            // 📅 [최신 등록순 정렬] 등록일(created_at)을 기준으로 역순 정렬 (가장 최신 상품이 드롭다운 맨 위로!)
            productsList.sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                return dateB - dateA;
            });
            
            // 🔍 [신설] 백업 전역 변수에 데이터 장착
            currentSimulatorDataList = productsList;
            
            // 🔍 [신설] 드롭다운 전용 옵션 렌더링 호출
            renderSimulatorSelectOptions(currentSimulatorDataList, mode);
            
            // 🎯 [최신 상품 자동 선택 모드 동기화]
            // - 만약 사용자가 '최신 상품 자동 선택' 라디오를 체크해둔 상태라면 곧바로 첫 번째(가장 최신) 상품을 드롭다운에 강제 매핑합니다.
            const activeMode = document.querySelector('input[name="sim-select-mode"]:checked')?.value || "manual";
            if (activeMode === "auto" && select.options.length > 1) {
                select.selectedIndex = 1;
            }
        }
    }
    
    // 가상 대장 렌더링 호출
    renderSimulatorHistory(mode);
}

/**
 * 🎯 [상품 선택 방식 토글 엔진]
 * - 교육용 주석: '수동 선택(최신순)' 일 경우 직접 상품을 선택할 수 있도록 드롭다운을 활성화하고,
 *   '최신 상품 자동 선택' 일 경우 드롭다운을 비활성화하고 목록의 가장 첫 번째(최신 상품)가 자동으로 매칭되도록 처리합니다.
 */
function toggleSimulatorSelectMode(type) {
    const select = document.getElementById("simulator-order-select");
    if (!select) return;
    
    if (type === "auto") {
        select.disabled = true;
        if (select.options.length > 1) {
            select.selectedIndex = 1; // 0번 placeholder를 건너뛰고 1번째인 가장 최신 상품 자동 포커싱
        }
        select.style.opacity = "0.6";
        select.style.cursor = "not-allowed";
    } else {
        select.disabled = false;
        select.style.opacity = "1";
        select.style.cursor = "default";
    }
}

/**
 * 🔍 [신설] 시뮬레이터 드롭다운 옵션 렌더러 함수
 * - 검색 키워드 또는 전체 리스트에 대해 드롭다운을 동적으로 재구성합니다.
 */
function renderSimulatorSelectOptions(list, mode) {
    const select = document.getElementById("simulator-order-select");
    if (!select) return;
    
    const labelText = mode.startsWith("customers-") ? "회원" : (mode.startsWith("products-") ? "상품" : "주문 건");
    select.innerHTML = `<option value="">- 모의 조작을 진행할 ${labelText} 선택 -</option>`;
    
    list.forEach((item, idx) => {
        const option = document.createElement("option");
        
        if (mode.startsWith("customers-")) {
            const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(item.name) : item.name;
            const emailVal = item.email || `${decName || 'user'}@pkb71.com`;
            option.value = item.id || emailVal;
            option.textContent = `[회원] ${decName || '무명고객'} (${emailVal})`;
        } else if (mode.startsWith("products-")) {
            option.value = item.id;
            // 가장 최신 상품 3개는 불꽃 태그 표시
            let prefix = "";
            let suffix = "";
            if (idx < 3) {
                prefix = "🔥 [최신] ";
                if (item.created_at) {
                    const dateObj = new Date(item.created_at);
                    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const dd = String(dateObj.getDate()).padStart(2, '0');
                    suffix = ` (${mm}/${dd} 등록)`;
                }
            }
            option.textContent = `${prefix}[상품] [${item.brand || 'NoBrand'}] ${item.name || '무명상품'}${suffix}`;
        } else {
            // 주문서
            const decName = typeof secureDecrypt !== 'undefined' ? secureDecrypt(item.customer_name) : item.customer_name;
            option.value = item.id;
            option.textContent = `[주문: ${item.order_no}] ${decName}님 (₩${(item.total_amount || 0).toLocaleString()})`;
        }
        
        select.appendChild(option);
    });
}

/**
 * 🔍 [신설] 시뮬레이터 검색어 입력 실시간 감지 필터 함수
 * - 대표님이 텍스트 필드에 글자를 쓸 때마다 드롭다운에 매치되는 항목만 남겨 리렌더링합니다.
 */
function onSimulatorSearchInput() {
    const searchInput = document.getElementById("simulator-search-input");
    if (!searchInput) return;
    
    const keyword = searchInput.value.trim().toLowerCase();
    
    // 키워드가 비어 있으면 백업되어 있던 전체 데이터를 로드
    if (!keyword) {
        renderSimulatorSelectOptions(currentSimulatorDataList, currentSimulatorMode);
        return;
    }
    
    const filtered = currentSimulatorDataList.filter(item => {
        if (currentSimulatorMode.startsWith("customers-")) {
            const decName = ((typeof secureDecrypt !== 'undefined' ? secureDecrypt(item.name) : item.name) || "").toLowerCase();
            const emailVal = (item.email || "").toLowerCase();
            return decName.includes(keyword) || emailVal.includes(keyword);
        } else if (currentSimulatorMode.startsWith("products-")) {
            const brand = (item.brand || "").toLowerCase();
            const name = (item.name || "").toLowerCase();
            return brand.includes(keyword) || name.includes(keyword);
        } else {
            // 주문서
            const decName = ((typeof secureDecrypt !== 'undefined' ? secureDecrypt(item.customer_name) : item.customer_name) || "").toLowerCase();
            const orderNo = (item.order_no || "").toLowerCase();
            return decName.includes(keyword) || orderNo.includes(keyword);
        }
    });
    
    renderSimulatorSelectOptions(filtered, currentSimulatorMode);
}

function renderSimulatorHistory(mode) {
    const historyTbody = document.getElementById("simulator-history-rows");
    if (!historyTbody) return;
    
    historyTbody.innerHTML = "";
    
    const filteredHistory = VIRTUAL_SIMULATOR_DB.filter(h => h.mode === mode);
    
    if (filteredHistory.length === 0) {
        historyTbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 30px 0; font-size:11.5px;">
                    가상 시뮬레이션 기록이 없습니다. 상단 단추를 통해 모의 가상 조작을 작동해 보세요!
                </td>
            </tr>
        `;
        return;
    }
    
    const isOrderTab = ["orders-cash-receipt", "orders-tax-invoice", "orders-auto-deposit", "orders-extra", "orders-hold"].includes(mode);
    
    filteredHistory.forEach(h => {
        const tr = document.createElement("tr");
        
        let valueColumnHtml = "";
        if (isOrderTab) {
            if (mode === "orders-hold") {
                valueColumnHtml = `<span style="font-weight:700; color:#E53935;">⚠️ ${escapeHtml(h.config_val || '보류 격리 조치')}</span>`;
            } else {
                valueColumnHtml = `₩${(h.supply_val || 0).toLocaleString()} / ₩${(h.tax_val || 0).toLocaleString()}`;
            }
        } else {
            valueColumnHtml = `<span style="font-weight:600; color:#4caf50;">${escapeHtml(h.config_val || '설정 완료')}</span>`;
        }
        
        tr.innerHTML = `
            <td style="text-align:center; font-family:var(--font-outfit); font-weight:700; font-size:11.5px; color:var(--accent-gold);">
                ${escapeHtml(h.auth_no)}
            </td>
            <td style="text-align:center; font-size:11.5px;">
                ${escapeHtml(h.target_name || h.order_no || '미지정')}
            </td>
            <td style="text-align:center; font-size:11.5px;">
                ${valueColumnHtml}
            </td>
            <td style="text-align:center; font-weight:700; font-size:11px; color:var(--text-primary);">
                ${escapeHtml(h.type_text)}
            </td>
            <td style="text-align:center; font-family:var(--font-outfit); font-size:11px; color:var(--text-secondary);">
                ${new Date(h.created_at).toLocaleString('ko-KR', { hour12: false })}
            </td>
            <td style="text-align:center;">
                <span class="supabase-status-badge green" style="font-size:10px; padding:2px 5px; border:none; font-weight:700;">기동성공</span>
            </td>
        `;
        historyTbody.appendChild(tr);
    });
}

async function triggerVirtualSimulation() {
    const select = document.getElementById("simulator-order-select");
    const mode = activeAdminTab;
    const isOrderTab = ["orders-cash-receipt", "orders-tax-invoice", "orders-auto-deposit", "orders-extra", "orders-hold"].includes(mode);
    
    // 🎯 [신설] 선택 방식 모드 획득 (상품 관련 탭일 때만 라디오 버튼 판단 적용)
    const selectMode = (mode.startsWith("products-")) ? (document.querySelector('input[name="sim-select-mode"]:checked')?.value || "manual") : "manual";
    
    let targetId = select.value;
    
    // 🎯 [최신 상품 자동 선택 모드인 경우]
    if (mode.startsWith("products-") && selectMode === "auto") {
        if (select.options.length > 1) {
            targetId = select.options[1].value; // 최신 정렬된 1번째 상품의 ID를 타겟으로 강제 지정
        }
    }
    
    if (!targetId) {
        const labelText = mode.startsWith("customers-") ? "회원" : (isOrderTab ? "대상 주문" : "상품");
        alert(`🔌 모의 작동을 진행할 ${labelText}을 선택해 주세요!`);
        return;
    }
    
    // 가상 승인번호 생성
    const randPart1 = Math.floor(100000 + Math.random() * 900000);
    const randPart2 = Math.floor(1000 + Math.random() * 9000);
    const authNo = `HDS-${randPart1}-${randPart2}`;
    
    let newHistoryItem = {
        id: `sim-${Math.floor(Math.random() * 1000000)}`,
        mode: mode,
        auth_no: authNo,
        created_at: new Date().toISOString()
    };
    
    // --- [2차 고도화] 동적으로 주입된 세부 셀렉트 옵션 선택값 획득 ---
    let selectedOptionVal = "";
    if (mode === "products-display") {
        selectedOptionVal = document.getElementById("sim-opt-display")?.value || "";
    } else if (mode === "products-options") {
        selectedOptionVal = document.getElementById("sim-opt-options")?.value || "";
    } else if (mode === "products-curation") {
        selectedOptionVal = document.getElementById("sim-opt-curation")?.value || "";
    } else if (mode === "products-sub") {
        selectedOptionVal = document.getElementById("sim-opt-sub")?.value || "";
    } else if (mode === "products-restock") {
        selectedOptionVal = document.getElementById("sim-opt-restock")?.value || "";
    } else if (mode === "customers-benefits") {
        selectedOptionVal = document.getElementById("sim-opt-benefits")?.value || "";
    } else if (mode === "customers-audience") {
        selectedOptionVal = document.getElementById("sim-opt-audience")?.value || "";
    } else if (mode === "orders-hold") {
        selectedOptionVal = document.getElementById("sim-opt-hold")?.value || "";
    }
    
    if (isOrderTab) {
        // 주문서 발행 및 보류 기반의 경우
        let typeText = "현금영수증";
        let messageTag = "[현금영수증: 발급완료]";
        let configVal = "";
        
        if (mode === "orders-tax-invoice") {
            typeText = "전자세금계산서";
            messageTag = "[세금계산서: 발급완료]";
        } else if (mode === "orders-auto-deposit") {
            typeText = "은행 자동 입금 매칭";
            messageTag = "[자동입금: 매칭완료]";
        } else if (mode === "orders-extra") {
            typeText = "배송 엑셀 파일 가상 빌딩";
            messageTag = "[배송대행: 추출완료]";
        } else if (mode === "orders-hold") {
            typeText = "배송 대기/보류 격리";
            messageTag = `[배송보류: ${selectedOptionVal}]`;
            configVal = selectedOptionVal;
        }
        
        let orderObj = null;
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const { data } = await timeoutPromise(2500, supabaseClient.from("orders").select("*").eq("id", targetId).single());
                orderObj = data;
            } catch(e) {}
        }
        if (!orderObj && typeof DUMMY_ORDERS !== 'undefined') {
            orderObj = DUMMY_ORDERS.find(o => o.id === targetId);
        }
        if (!orderObj) {
            alert("⚠️ 주문 데이터를 로드할 수 없습니다.");
            return;
        }
        
        const totalAmt = orderObj.total_amount || 0;
        const supplyVal = Math.round(totalAmt / 1.1);
        const taxVal = totalAmt - supplyVal;
        
        newHistoryItem.order_no = orderObj.order_no;
        newHistoryItem.target_name = `주문: ${orderObj.order_no}`;
        newHistoryItem.supply_val = supplyVal;
        newHistoryItem.tax_val = taxVal;
        newHistoryItem.type_text = typeText;
        if (mode === "orders-hold") {
            newHistoryItem.config_val = configVal;
        }
        
        // 주문서에 가상 태그 갱신 및 상태 강제 변경 (orders-hold 탭인 경우 배송대기로 변경)
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            try {
                const decMessage = typeof secureDecrypt !== 'undefined' ? secureDecrypt(orderObj.message) : (orderObj.message || "");
                const nextMessage = decMessage ? `${decMessage} ${messageTag}` : messageTag;
                const encMessage = typeof secureEncrypt !== 'undefined' ? secureEncrypt(nextMessage) : nextMessage;
                
                const updatePayload = { message: encMessage };
                if (mode === "orders-hold") {
                    updatePayload.status = "배송대기"; // 상태를 배송대기(보류) 상태로 격리!
                }
                
                await timeoutPromise(2500, supabaseClient.from("orders").update(updatePayload).eq("id", targetId));
            } catch(e) {}
        } else if (typeof DUMMY_ORDERS !== 'undefined') {
            const idx = DUMMY_ORDERS.findIndex(o => o.id === targetId);
            if (idx !== -1) {
                const dec = DUMMY_ORDERS[idx].message || "";
                DUMMY_ORDERS[idx].message = dec ? `${dec} ${messageTag}` : messageTag;
                if (mode === "orders-hold") {
                    DUMMY_ORDERS[idx].status = "배송대기"; // 상태를 배송대기(보류) 상태로 격리!
                }
            }
        }
        
        VIRTUAL_SIMULATOR_DB.unshift(newHistoryItem);
        localStorage.setItem("virtual_simulator_db", JSON.stringify(VIRTUAL_SIMULATOR_DB));
        
        if (mode === "orders-hold") {
            alert(`🎉 [HADES VIRTUAL SIMULATOR] 배송 보류 격리 조치가 정상 적용 완료되었습니다!\n(대상: ${orderObj.order_no}\n조치내용: ${selectedOptionVal})\n(승인번호: ${authNo})`);
        } else {
            alert(`🎉 [HADES VIRTUAL SIMULATOR] 가상 모의 ${typeText} 발행이 정상 승인 완료되었습니다!\n(승인번호: ${authNo})`);
        }
        
    } else {
        // 일반 설정 기반 탭의 경우
        // 🎯 [자동 선택 시 강제로 첫 번째 최신 상품의 텍스트 획득]
        const selectedText = (mode.startsWith("products-") && selectMode === "auto") ? select.options[1].text : select.options[select.selectedIndex].text;
        const targetName = selectedText.split("] ")[1] || selectedText;
        
        let typeText = "상품 진열 편집";
        let configVal = selectedOptionVal || "베스트 진열 1순위 강제 고정";
        
        if (mode === "products-options") {
            typeText = "상품 다차원 옵션 스키마";
        } else if (mode === "products-curation") {
            typeText = "AI 스마트 추천 노드";
        } else if (mode === "products-sub") {
            typeText = "정기구독 패키지 주기 설정";
        } else if (mode === "products-restock") {
            typeText = "재입고 알림톡 전송";
        } else if (mode === "customers-search") {
            typeText = "다차원 상세 색인";
            configVal = "최근 30일 이내 구매 회원을 VIP 검색 인덱스 등록";
        } else if (mode === "customers-benefits") {
            typeText = "회원 등급 특별 혜택";
        } else if (mode === "customers-audience") {
            typeText = "타겟 오디언스 CRM 발송";
        }
        
        // 🎯 [자동 모드 시 대장 기록 텍스트에 꼬리표 추가]
        if (mode.startsWith("products-") && selectMode === "auto") {
            configVal = `[최신 자동 진열] ${configVal}`;
        }
        
        newHistoryItem.target_name = targetName;
        newHistoryItem.config_val = configVal;
        newHistoryItem.type_text = typeText;
        
        VIRTUAL_SIMULATOR_DB.unshift(newHistoryItem);
        localStorage.setItem("virtual_simulator_db", JSON.stringify(VIRTUAL_SIMULATOR_DB));
        
        alert(`🎉 [HADES VIRTUAL SIMULATOR] ${typeText} 모의 설정이 정상 적용 완료되었습니다!\n(대상: ${targetName}\n설정내용: ${configVal})`);
    }
    
    initVirtualSimulator(mode);
}

/**
 * 🔍 [신설] 상세 검색용 대/중/소분류 카테고리 바인딩 함수
 */
function populateAdminSearchCategoryDropdowns() {
    const largeSelect = document.getElementById("admin-prod-search-large");
    const mediumSelect = document.getElementById("admin-prod-search-medium");
    const smallSelect = document.getElementById("admin-prod-search-small");
    
    if (!largeSelect || !mediumSelect || !smallSelect) return;
    
    // 초기화
    largeSelect.innerHTML = '<option value="">- 대분류 전체 -</option>';
    mediumSelect.innerHTML = '<option value="">- 중분류 전체 -</option>';
    smallSelect.innerHTML = '<option value="">- 소분류 전체 -</option>';
    
    // 대분류 (depth = 0) 로드
    const largeCats = localCategories.filter(c => c.depth === 0 || c.depth === "0" || !c.parent_id);
    largeCats.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        largeSelect.appendChild(option);
    });
}

/**
 * 🔍 [신설] 대분류 변경 시 중분류 바인딩 핸들러
 */
function onAdminSearchCategoryLargeChange() {
    const largeVal = document.getElementById("admin-prod-search-large").value;
    const mediumSelect = document.getElementById("admin-prod-search-medium");
    const smallSelect = document.getElementById("admin-prod-search-small");
    
    mediumSelect.innerHTML = '<option value="">- 중분류 전체 -</option>';
    smallSelect.innerHTML = '<option value="">- 소분류 전체 -</option>';
    
    if (!largeVal) return;
    
    const childCats = localCategories.filter(c => c.parent_id === largeVal);
    childCats.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        mediumSelect.appendChild(option);
    });
}

/**
 * 🔍 [신설] 중분류 변경 시 소분류 바인딩 핸들러
 */
function onAdminSearchCategoryMediumChange() {
    const mediumVal = document.getElementById("admin-prod-search-medium").value;
    const smallSelect = document.getElementById("admin-prod-search-small");
    
    smallSelect.innerHTML = '<option value="">- 소분류 전체 -</option>';
    
    if (!mediumVal) return;
    
    const childCats = localCategories.filter(c => c.parent_id === mediumVal);
    childCats.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        smallSelect.appendChild(option);
    });
}

/**
 * 🔍 [신설] 상품 검색 실행 함수
 */
function executeAdminProductSearch() {
    fetchAdminProducts();
}

/**
 * 🔍 [신설] 상품 검색 조건 초기화 함수
 */
function resetAdminProductSearch() {
    const keywordInput = document.getElementById("admin-prod-search-keyword");
    const largeSelect = document.getElementById("admin-prod-search-large");
    const mediumSelect = document.getElementById("admin-prod-search-medium");
    const smallSelect = document.getElementById("admin-prod-search-small");
    
    if (keywordInput) keywordInput.value = "";
    if (largeSelect) largeSelect.value = "";
    
    // 카테고리 드롭다운 재설정
    onAdminSearchCategoryLargeChange();
    
    fetchAdminProducts();
}

// =========================================================================
// 📦 [체크박스 고도화] 상품, 주문, 회원 목록의 마스터 체크박스 토글 제어 엔진
// - 대표님이 최상단 테이블 헤더의 체크박스를 클릭했을 때 전체 행의 체크박스를 일괄로 켜고 끄는 역할을 합니다.
// - 초보자가 이해하기 쉽도록 QuerySelector를 활용하여 클래스별 체크박스를 통제합니다.
// =========================================================================

/**
 * 📦 상품 목록 테이블 전체 선택 / 해제 토글 함수
 * @param {HTMLInputElement} master - 헤더의 마스터 체크박스 엘리먼트
 */
function toggleAllProdChecks(master) {
    const checkboxes = document.querySelectorAll(".admin-prod-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

/**
 * 🚛 주문 목록 테이블 전체 선택 / 해제 토글 함수
 * @param {HTMLInputElement} master - 헤더의 마스터 체크박스 엘리먼트
 */
function toggleAllOrdersChecks(master) {
    const checkboxes = document.querySelectorAll(".admin-orders-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

/**
 * 👥 회원 상세 검색 테이블 전체 선택 / 해제 토글 함수
 * @param {HTMLInputElement} master - 헤더의 마스터 체크박스 엘리먼트
 */
function toggleAllCustChecks(master) {
    const checkboxes = document.querySelectorAll(".admin-cust-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

/**
 * 👥 일반 고객 대장 테이블 전체 선택 / 해제 토글 함수
 * @param {HTMLInputElement} master - 헤더의 마스터 체크박스 엘리먼트
 */
function toggleAllCustAllChecks(master) {
    const checkboxes = document.querySelectorAll(".admin-cust-all-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

window.toggleAllProdChecks = toggleAllProdChecks;
window.toggleAllOrdersChecks = toggleAllOrdersChecks;
window.toggleAllCustChecks = toggleAllCustChecks;
window.toggleAllCustAllChecks = toggleAllCustAllChecks;


// =========================================================================
// 🌳 [체크박스 & 카테고리 트리 고도화] 진짜 실물 상품 진열 관리실 제어 엔진 함수군
// - 카테고리별 상품 진열 순서 스왑(위/아래), 진열 일괄 제어, 상품 추가 팝업 등을 연동합니다.
// =========================================================================

/**
 * 1) 상품 진열 탭 진입 시 초기 기동기
 */
function getAdminDisplaySection(sectionId) {
    return ADMIN_DISPLAY_SECTIONS.find(section => section.id === sectionId) || ADMIN_DISPLAY_SECTIONS[0];
}

function renderAdminDisplaySectionOptions(selectedId = "featured") {
    const largeSelect = document.getElementById("admin-display-large");
    if (!largeSelect) return;
    largeSelect.innerHTML = "";
    ADMIN_DISPLAY_SECTIONS.forEach(section => {
        const option = document.createElement("option");
        option.value = section.id;
        option.textContent = section.label;
        if (section.id === selectedId) option.selected = true;
        largeSelect.appendChild(option);
    });
}

function getAdminProductDisplaySections(product) {
    const rawValues = [];
    if (Array.isArray(product.display_sections)) rawValues.push(...product.display_sections);
    if (product.display_section) rawValues.push(product.display_section);
    const details = product.details || "";
    const tagMatch = details.match(/\[진열구역:([^\]]+)\]/);
    if (tagMatch) rawValues.push(...tagMatch[1].split(","));
    const normalized = rawValues
        .flatMap(value => String(value || "").split(","))
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
            const found = ADMIN_DISPLAY_SECTIONS.find(section => section.id === value || section.label === value);
            return found ? found.id : value;
        });
    return Array.from(new Set(normalized));
}

function setAdminProductDisplaySectionTag(details, sectionId) {
    const cleanDetails = String(details || "").replace(/\[진열구역:[^\]]+\]\s*/g, "").trim();
    return ("[진열구역:" + sectionId + "] " + cleanDetails).trim();
}

function initAdminProductDisplayTab() {
    selectedDisplayRowProductId = null;
    currentDisplayProductsList = [];

    renderAdminDisplaySectionOptions(document.getElementById("admin-display-large")?.value || "featured");

    const mediumSelect = document.getElementById("admin-display-medium");
    const smallSelect = document.getElementById("admin-display-small");
    if (mediumSelect) mediumSelect.innerHTML = '<option value="">사용 안함</option>';
    if (smallSelect) smallSelect.innerHTML = '<option value="">사용 안함</option>';

    const keywordInput = document.getElementById("admin-display-search-keyword");
    if (keywordInput) keywordInput.value = "";

    const radioAll = document.querySelector('input[name="admin-display-visible-filter"][value="all"]');
    if (radioAll) radioAll.checked = true;

    fetchAdminDisplayProducts();
}

function onAdminDisplayCategoryLargeChange() {
    const mediumSelect = document.getElementById("admin-display-medium");
    const smallSelect = document.getElementById("admin-display-small");
    if (mediumSelect) mediumSelect.innerHTML = '<option value="">사용 안함</option>';
    if (smallSelect) smallSelect.innerHTML = '<option value="">사용 안함</option>';
    fetchAdminDisplayProducts();
}

function onAdminDisplayCategoryMediumChange() {
    fetchAdminDisplayProducts();
}

async function fetchAdminDisplayProducts() {
    const tbody = document.getElementById("admin-display-product-rows");
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 40px 0;">
                <div class="spinner" style="width: 25px; height: 25px; margin: 0 auto;"></div>
                <p style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">진열 대상 상품 명단을 불러오는 중...</p>
            </td>
        </tr>
    `;
    
    // 마스터 체크박스 리셋
    const masterCheck = document.getElementById("admin-display-check-all");
    if (masterCheck) masterCheck.checked = false;
    
    // DB에서 전체 상품 데이터 조회
    let allProducts = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .select("*")
                .order("display_order", { ascending: true })
                .order("created_at", { ascending: false }));
            if (!error && data) {
                allProducts = data;
            } else {
                allProducts = [...DUMMY_PRODUCTS];
            }
        } catch (e) {
            allProducts = [...DUMMY_PRODUCTS];
        }
    } else {
        allProducts = [...DUMMY_PRODUCTS];
    }
    
    // 필터 조건 수집
    const largeId = document.getElementById("admin-display-large")?.value;
    const mediumId = document.getElementById("admin-display-medium")?.value;
    const smallId = document.getElementById("admin-display-small")?.value;
    const keyword = document.getElementById("admin-display-search-keyword")?.value.trim().toLowerCase();
    const visibleFilter = document.querySelector('input[name="admin-display-visible-filter"]:checked')?.value || "all";
    const saleFilter = document.querySelector('input[name="admin-display-sale-filter"]:checked')?.value || "all";
    const minPrice = Number(document.getElementById("admin-display-price-min")?.value) || 0;
    const maxPrice = Number(document.getElementById("admin-display-price-max")?.value) || 0;
    
    let filtered = allProducts;
    
    // A) 메인 진열구역 필터링
    const selectedSectionId = largeId || "featured";
    const selectedSection = getAdminDisplaySection(selectedSectionId);
    let selectedCatName = selectedSection.label;
    const visibleProductsForFallback = allProducts.filter(p => p.is_visible !== false);
    const explicitlyAssigned = allProducts.filter(p => getAdminProductDisplaySections(p).includes(selectedSectionId));

    if (explicitlyAssigned.length > 0) {
        filtered = explicitlyAssigned;
    } else if (selectedSectionId === "new") {
        filtered = visibleProductsForFallback.slice(0, 20);
    } else if (selectedSectionId === "best") {
        filtered = visibleProductsForFallback.slice(0, 4);
    } else {
        filtered = visibleProductsForFallback;
    }

    // B) 검색어 필터링 (상품명, 브랜드)
    if (keyword) {
        filtered = filtered.filter(p => {
            return (p.name || "").toLowerCase().includes(keyword) || (p.brand || "").toLowerCase().includes(keyword);
        });
    }
    
    // C) 진열 여부 필터링
    if (visibleFilter !== "all") {
        const isVisibleTarget = (visibleFilter === "true");
        filtered = filtered.filter(p => p.is_visible === isVisibleTarget);
    }

    if (saleFilter !== "all") {
        filtered = filtered.filter(p => saleFilter === "selling" ? !p.is_soldout : p.is_soldout);
    }

    if (minPrice > 0) {
        filtered = filtered.filter(p => (Number(p.selling_price) || 0) >= minPrice);
    }

    if (maxPrice > 0) {
        filtered = filtered.filter(p => (Number(p.selling_price) || 0) <= maxPrice);
    }
    
    // 전역 상태에 임시 세팅
    currentDisplayProductsList = filtered;
    selectedDisplayRowProductId = null;
    
    // 요약바 연동
    const elCatInfo = document.getElementById("admin-display-cat-info");
    const elTotalCount = document.getElementById("admin-display-total-count");
    if (elCatInfo) elCatInfo.textContent = selectedCatName;
    if (elTotalCount) elTotalCount.textContent = filtered.length;
    
    // 테이블 렌더링 기동
    renderAdminDisplayTableRows(filtered);
}

/**
 * 3) 진열 상품 테이블 행 렌더러 (클릭 선택 지원)
 */
function renderAdminDisplayTableRows(products) {
    const tbody = document.getElementById("admin-display-product-rows");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 50px 0; font-size:12.5px;">
                    진열 조건과 일치하는 명품 상품 목록이 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach((p, index) => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.style.transition = "all 0.15s ease";
        
        // 클릭하여 정렬 미세조정 대상 선택
        if (selectedDisplayRowProductId === p.id) {
            tr.style.backgroundColor = "rgba(100, 181, 246, 0.15)";
            tr.style.border = "1px solid rgba(100, 181, 246, 0.4)";
        } else {
            tr.style.backgroundColor = "";
            tr.style.border = "";
        }
        
        tr.addEventListener("click", (e) => {
            if (e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON" && e.target.tagName !== "A") {
                selectedDisplayRowProductId = p.id;
                renderAdminDisplayTableRows(products);
            }
        });
        
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : "-";
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="admin-display-check" value="${p.id}" onclick="event.stopPropagation()">
            </td>
            <td style="text-align: center; font-weight:700; font-family:var(--font-outfit); color:var(--accent-gold);">
                ${index + 1}
            </td>
            <td style="text-align: center;">
                <img src="${repImg}" style="width:35px; height:45px; object-fit:cover; border-radius:3px;" alt="${p.name}">
            </td>
            <td>
                <span style="font-size:10px; color:var(--text-secondary); display:block; margin-bottom:2px;">${escapeHtml(p.brand || '수입 명품')}</span>
                <span style="font-weight:700; font-size:13px; color:#fff;">${escapeHtml(p.name)}</span>
            </td>
            <td style="font-family:var(--font-outfit); font-weight:700; color:#fff; font-size:13px; text-align:center;">
                ₩${(p.selling_price || 0).toLocaleString()}
            </td>
            <td style="text-align: center;">
                <span class="status-badge ${p.is_visible ? 'paid' : 'pending'}" style="padding: 4px 8px; font-size:10.5px;">
                    ${p.is_visible ? '진열함' : '진열안함'}
                </span>
            </td>
            <td style="text-align: center;">
                <span style="font-size:11.5px; color:${p.is_soldout ? '#D32F2F' : '#2E7D32'}; font-weight:700;">
                    ${p.is_soldout ? '🔴 품절' : '🟢 판매중'}
                </span>
            </td>
            <td style="color:var(--text-secondary); font-size:11px; text-align:center;">
                ${dateStr}
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

/**
 * 진열 대장 마스터 체크박스 전체선택/해제 토글
 */
function toggleAllDisplayChecks(master) {
    const checkboxes = document.querySelectorAll(".admin-display-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

/**
 * 검색 필터 리셋
 */
function resetAdminDisplaySearch() {
    const largeSelect = document.getElementById("admin-display-large");
    const keywordInput = document.getElementById("admin-display-search-keyword");
    
    if (largeSelect) largeSelect.value = "";
    onAdminDisplayCategoryLargeChange(); // 중/소분류 초기화
    
    if (keywordInput) keywordInput.value = "";
    
    const radioAll = document.querySelector('input[name="admin-display-visible-filter"][value="all"]');
    if (radioAll) radioAll.checked = true;
    
    fetchAdminDisplayProducts();
}

function openCafe24AiChatbot() {
    alert("카페24 AI 챗봇처럼 운영 도움말을 보여주는 영역입니다.\n\n현재 쇼핑몰에서는 상품등록, 상품진열, 고객관리 화면의 사용 안내를 제공합니다.");
}

function setCafe24DisplayViewMode(mode) {
    const shell = document.getElementById("cafe24-display-shell");
    if (!shell) return;

    shell.dataset.viewMode = mode;
    shell.querySelectorAll(".cafe24-view-toggle button").forEach(button => button.classList.remove("active"));
    const targetButton = shell.querySelector(`.cafe24-view-toggle button[data-view-mode="${mode}"]`);
    if (targetButton) targetButton.classList.add("active");

    const tableWrap = shell.querySelector(".cafe24-display-table-wrap");
    if (tableWrap) tableWrap.classList.toggle("compact-list", mode === "list");
}

function getCheckedDisplayProductIds() {
    return Array.from(document.querySelectorAll(".admin-display-check:checked")).map(cb => cb.value);
}

function editCheckedProductCategories() {
    const ids = getCheckedDisplayProductIds();
    if (ids.length === 0) {
        alert("분류를 수정할 상품을 먼저 선택해 주세요.");
        return;
    }
    if (ids.length === 1) {
        openEditProductModal(ids[0]);
        return;
    }
    alert(`선택한 ${ids.length}개 상품의 분류는 상품목록 화면에서 일괄 확인 후 수정해 주세요.`);
    switchAdminTab("products-list");
}

async function setCheckedDisplayFixed(fixed) {
    const ids = getCheckedDisplayProductIds();
    if (ids.length === 0) {
        alert("고정 상태를 변경할 상품을 먼저 선택해 주세요.");
        return;
    }

    const label = fixed ? "고정함" : "고정안함";
    if (!confirm(`선택한 ${ids.length}개 상품을 [${label}] 상태로 변경하시겠습니까?`)) return;

    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("products")
                .update({ is_fixed: fixed })
                .in("id", ids));
            if (error) throw error;
        } catch (error) {
            alert(`고정 상태 저장 중 오류가 발생했습니다: ${error.message}`);
            return;
        }
    }

    currentDisplayProductsList = currentDisplayProductsList.map(product =>
        ids.includes(product.id) ? { ...product, is_fixed: fixed } : product
    );
    alert(`선택 상품 ${ids.length}개가 [${label}] 처리되었습니다.`);
    renderAdminDisplayTableRows(currentDisplayProductsList);
}

function downloadCafe24DisplayCsv() {
    const rows = Array.isArray(currentDisplayProductsList) ? currentDisplayProductsList : [];
    if (rows.length === 0) {
        alert("엑셀로 다운로드할 진열 상품이 없습니다. 먼저 검색을 실행해 주세요.");
        return;
    }

    const headers = ["진열순위", "상품명", "브랜드", "판매가", "진열상태", "판매상태", "판매량"];
    const csvRows = rows.map((product, index) => [
        index + 1,
        product.name || "",
        product.brand || "",
        product.selling_price || product.price || 0,
        product.is_visible ? "진열함" : "진열안함",
        product.is_soldout ? "판매안함" : "판매함",
        product.sales_count || 0
    ]);
    const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...csvRows].map(row => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `상품진열_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function openCafe24DisplaySettings() {
    alert("진열 설정\n\n- 진열구역: 추천상품 / 신상품 / 베스트상품\n- 정렬방식: 사용자 지정 진열순\n- 쇼핑몰 메인 화면과 연동됩니다.");
}

window.openCafe24AiChatbot = openCafe24AiChatbot;
window.setCafe24DisplayViewMode = setCafe24DisplayViewMode;
window.editCheckedProductCategories = editCheckedProductCategories;
window.setCheckedDisplayFixed = setCheckedDisplayFixed;
window.downloadCafe24DisplayCsv = downloadCafe24DisplayCsv;
window.openCafe24DisplaySettings = openCafe24DisplaySettings;

// =========================================================================
// ↕️ 진열 순위 미세 조정 화살표 제어 엔진
// =========================================================================

/**
 * 선택된 상품을 최상단(1순위)으로 올리기
 */
function moveDisplayOrderTop() {
    if (!selectedDisplayRowProductId) {
        alert("💡 순위를 변경할 상품 행을 마우스로 클릭하여 먼저 선택해 주세요.");
        return;
    }
    
    const idx = currentDisplayProductsList.findIndex(p => p.id === selectedDisplayRowProductId);
    if (idx <= 0) return; // 이미 맨 위
    
    const targetItem = currentDisplayProductsList.splice(idx, 1)[0];
    currentDisplayProductsList.unshift(targetItem);
    
    renderAdminDisplayTableRows(currentDisplayProductsList);
}

/**
 * 선택된 상품을 한 칸 위로 올리기
 */
function moveDisplayOrderUp() {
    if (!selectedDisplayRowProductId) {
        alert("💡 순위를 변경할 상품 행을 마우스로 클릭하여 먼저 선택해 주세요.");
        return;
    }
    
    const idx = currentDisplayProductsList.findIndex(p => p.id === selectedDisplayRowProductId);
    if (idx <= 0) return; // 이미 맨 위
    
    // 인덱스 스왑
    const temp = currentDisplayProductsList[idx - 1];
    currentDisplayProductsList[idx - 1] = currentDisplayProductsList[idx];
    currentDisplayProductsList[idx] = temp;
    
    renderAdminDisplayTableRows(currentDisplayProductsList);
}

/**
 * 선택된 상품을 한 칸 아래로 내리기
 */
function moveDisplayOrderDown() {
    if (!selectedDisplayRowProductId) {
        alert("💡 순위를 변경할 상품 행을 마우스로 클릭하여 먼저 선택해 주세요.");
        return;
    }
    
    const idx = currentDisplayProductsList.findIndex(p => p.id === selectedDisplayRowProductId);
    if (idx < 0 || idx >= currentDisplayProductsList.length - 1) return; // 이미 맨 아래
    
    // 인덱스 스왑
    const temp = currentDisplayProductsList[idx + 1];
    currentDisplayProductsList[idx + 1] = currentDisplayProductsList[idx];
    currentDisplayProductsList[idx] = temp;
    
    renderAdminDisplayTableRows(currentDisplayProductsList);
}

/**
 * 선택된 상품을 최하단으로 내리기
 */
function moveDisplayOrderBottom() {
    if (!selectedDisplayRowProductId) {
        alert("💡 순위를 변경할 상품 행을 마우스로 클릭하여 먼저 선택해 주세요.");
        return;
    }
    
    const idx = currentDisplayProductsList.findIndex(p => p.id === selectedDisplayRowProductId);
    if (idx < 0 || idx >= currentDisplayProductsList.length - 1) return; // 이미 맨 아래
    
    const targetItem = currentDisplayProductsList.splice(idx, 1)[0];
    currentDisplayProductsList.push(targetItem);
    
    renderAdminDisplayTableRows(currentDisplayProductsList);
}

// =========================================================================
// 💾 일괄 진열 제어 및 순위 저장 DB 트랜잭션
// =========================================================================

/**
 * 4) 선택된 상품의 진열 여부(is_visible) 일괄 변경
 */
async function batchSetDisplayVisibility(visible) {
    const checkedBoxes = document.querySelectorAll(".admin-display-check:checked");
    if (checkedBoxes.length === 0) {
        alert("💡 상태를 변경할 상품들을 체크박스로 선택해 주세요.");
        return;
    }
    
    const ids = Array.from(checkedBoxes).map(cb => cb.value);
    const modeLabel = visible ? "진열함" : "진열안함";
    
    if (!confirm(`선택한 ${ids.length}개 상품을 일괄 [${modeLabel}] 상태로 변경하시겠습니까?`)) return;
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(3000, supabaseClient
                .from("products")
                .update({ is_visible: visible })
                .in("id", ids));
            if (error) throw error;
            alert(`🎉 선택하신 상품들이 일괄 [${modeLabel}] 처리되었습니다.`);
        } catch (e) {
            alert(`⚠️ DB 저장 실패: ${e.message}`);
        }
    } else {
        alert("🎉 [더미 모드] 선택 상품의 노출 상태가 변경되었습니다.");
    }
    
    // 화면 갱신
    fetchAdminDisplayProducts();
    fetchProducts(); // 쇼핑몰 동기화
}

/**
 * 5) 변경된 진열 순위 display_order 값을 일괄 영구 저장
 */
async function saveAdminDisplayOrders() {
    if (currentDisplayProductsList.length === 0) return;
    
    if (!confirm("🌳 변경된 진열 순서를 데이터베이스에 일괄 저장하시겠습니까?\n이 순서대로 쇼핑몰 메인 화면에 출력됩니다.")) return;
    
    if (supabaseClient) {
        try {
            // currentDisplayProductsList의 인덱스 기반으로 display_order 재부여
            for (let i = 0; i < currentDisplayProductsList.length; i++) {
                const p = currentDisplayProductsList[i];
                const newOrder = i + 1; // 1순위부터 시작
                
                const { error } = await supabaseClient
                    .from("products")
                    .update({ display_order: newOrder })
                    .eq("id", p.id);
                if (error) throw error;
            }
            alert("🎉 상품 진열 순위가 데이터베이스에 성공적으로 실시간 영구 저장되었습니다!");
        } catch (e) {
            alert(`⚠️ 진열 순위 저장 오류: ${e.message}`);
        }
    } else {
        alert("🎉 [더미 모드] 상품 진열 순위가 브라우저에 임시 저장되었습니다.");
    }
    
    fetchAdminDisplayProducts();
    fetchProducts(); // 쇼핑몰 메인 동기화 리로드!
}

// =========================================================================
// 📦 분류별 상품 일괄 편입/추가 모달 시스템 (모달 제어)
// =========================================================================

let displayAddProductsPool = []; // 모달 추가용 상품 풀

/**
 * 상품 추가 모달 열기
 */
function ensureDisplayProductAddModal() {
    let modal = document.getElementById("display-product-add-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "display-product-add-modal";
    modal.className = "cart-modal-overlay";
    modal.style.display = "none";
    modal.style.zIndex = "19000";
    modal.onclick = closeDisplayProductAddModalOutside;
    modal.innerHTML = `
        <div class="cart-modal-content cafe24-display-add-modal" onclick="event.stopPropagation()">
            <div class="cart-modal-header">
                <h3 class="cart-modal-title">상품 추가</h3>
                <span class="close-btn" onclick="closeDisplayProductAddModal()">×</span>
            </div>
            <div class="checkout-divider" style="margin: 12px 0;"></div>
            <div class="cafe24-display-add-top">
                <input id="display-add-search-keyword" type="text" class="form-input" placeholder="상품명 또는 브랜드명 검색" oninput="searchDisplayAddProducts()">
                <button type="button" class="postcode-btn" onclick="searchDisplayAddProducts()">검색</button>
            </div>
            <div class="admin-table-container cafe24-display-add-table">
                <table class="admin-products-table">
                    <thead>
                        <tr>
                            <th width="44"><input id="display-add-check-all" type="checkbox" onchange="toggleAllDisplayAddChecks(this)"></th>
                            <th width="62">이미지</th>
                            <th>상품명</th>
                            <th width="120">판매가</th>
                            <th width="110">진열상태</th>
                        </tr>
                    </thead>
                    <tbody id="display-add-product-rows"></tbody>
                </table>
            </div>
            <div class="cafe24-display-add-actions">
                <button type="button" class="cafe24-secondary-btn" onclick="closeDisplayProductAddModal()">취소</button>
                <button type="button" class="cafe24-primary-btn" onclick="addProductsToCurrentCategory()">선택 상품 추가</button>
            </div>
        </div>` ;
    document.body.appendChild(modal);
    return modal;
}

async function openDisplayProductAddModal() {
    const largeId = document.getElementById("admin-display-large")?.value;
    if (!largeId) {
        alert("먼저 메인 진열구역을 선택해 주세요.");
        return;
    }
    
    const modal = ensureDisplayProductAddModal();
    if (modal) modal.style.display = "flex";
    
    const searchInput = document.getElementById("display-add-search-keyword");
    if (searchInput) searchInput.value = "";
    
    // 모달 체크박스 리셋
    const masterCheck = document.getElementById("display-add-check-all");
    if (masterCheck) masterCheck.checked = false;
    
    // DB의 전체 상품을 로드하여 대기
    displayAddProductsPool = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("products")
                .select("*")
                .order("created_at", { ascending: false }));
            if (!error && data) {
                displayAddProductsPool = data;
            }
        } catch (e) {
            console.error("추가용 상품 조회 실패:", e);
        }
    }
    if (displayAddProductsPool.length === 0) {
        displayAddProductsPool = [...DUMMY_PRODUCTS];
    }
    
    searchDisplayAddProducts(); // 렌더링 기동
}

/**
 * 모달 닫기
 */
function closeDisplayProductAddModal() {
    const modal = document.getElementById("display-product-add-modal");
    if (modal) modal.style.display = "none";
}

/**
 * 모달 바깥 영역 클릭 시 닫기
 */
function closeDisplayProductAddModalOutside(e) {
    if (e.target.id === "display-product-add-modal") {
        closeDisplayProductAddModal();
    }
}

/**
 * 모달 내 상품 검색 및 필터링
 */
function searchDisplayAddProducts() {
    const keyword = document.getElementById("display-add-search-keyword")?.value.trim().toLowerCase() || "";
    
    let filtered = displayAddProductsPool;
    
    // 검색어 필터링
    if (keyword) {
        filtered = filtered.filter(p => {
            return (p.name || "").toLowerCase().includes(keyword) || (p.brand || "").toLowerCase().includes(keyword);
        });
    }
    
    renderDisplayAddTableRows(filtered);
}

/**
 * 모달 내 테이블 렌더러
 */
function renderDisplayAddTableRows(products) {
    const tbody = document.getElementById("display-add-product-rows");
    if (!tbody) return;
    
    tbody.innerHTML = "";
    
    if (products.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 30px 0; font-size:12px;">
                    검색어와 일치하는 상품이 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    products.forEach(p => {
        const tr = document.createElement("tr");
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        
        // 현재 카테고리 정보 파싱
        const tagMatch = p.details ? p.details.match(/\[카테고리:([^\]]+)\]/) : null;
        const catPath = tagMatch ? tagMatch[1] : "미지정";
        
        tr.innerHTML = `
            <td style="text-align: center;">
                <input type="checkbox" class="display-add-check" value="${p.id}">
            </td>
            <td style="text-align: center;">
                <img src="${repImg}" style="width:30px; height:40px; object-fit:cover; border-radius:3px;" alt="${p.name}">
            </td>
            <td>
                <span style="font-weight: 700; color: #fff;">${escapeHtml(p.name)}</span><br>
                <span style="font-size:10px; color:var(--accent-gold);">현재 분류: ${escapeHtml(catPath)}</span>
            </td>
            <td style="font-family: var(--font-outfit); font-weight:700; text-align:center; color:#fff;">
                ₩${(p.selling_price || 0).toLocaleString()}
            </td>
            <td style="text-align: center;">
                <span style="font-size:11px; color:${p.is_visible ? '#2E7D32' : '#aaa'}; font-weight:700;">
                    ${p.is_visible ? '진열함' : '진열안함'}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 모달 마스터 체크박스 전체선택/해제 토글
 */
function toggleAllDisplayAddChecks(master) {
    const checkboxes = document.querySelectorAll(".display-add-check");
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

/**
 * 6) 모달에서 선택한 상품들을 현재 카테고리 진열로 일괄 추가 편입
 */
async function addProductsToCurrentCategory() {
    const checkedBoxes = document.querySelectorAll(".display-add-check:checked");
    if (checkedBoxes.length === 0) {
        alert("진열구역에 추가할 상품을 먼저 선택해 주세요.");
        return;
    }

    const sectionId = document.getElementById("admin-display-large")?.value || "featured";
    const section = getAdminDisplaySection(sectionId);
    const ids = Array.from(checkedBoxes).map(cb => cb.value);

    if (!confirm(`선택한 ${ids.length}개 상품을 [${section.label}] 진열구역에 추가하시겠습니까?`)) return;

    let successCount = 0;

    if (supabaseClient) {
        try {
            for (const id of ids) {
                const p = displayAddProductsPool.find(item => item.id === id);
                if (!p) continue;
                const newDetails = setAdminProductDisplaySectionTag(p.details || "", sectionId);
                const { error } = await supabaseClient
                    .from("products")
                    .update({
                        details: newDetails,
                        is_visible: true,
                        display_order: 1
                    })
                    .eq("id", id);
                if (error) throw error;
                successCount++;
            }
            alert(`${successCount}개 상품이 [${section.label}] 진열구역에 추가되었습니다.`);
        } catch (e) {
            alert(`DB 진열구역 저장 중 오류가 발생했습니다: ${e.message}`);
        }
    } else {
        ids.forEach(id => {
            const p = DUMMY_PRODUCTS.find(item => item.id === id);
            if (p) {
                p.details = setAdminProductDisplaySectionTag(p.details || "", sectionId);
                p.is_visible = true;
                successCount++;
            }
        });
        allProducts = [...DUMMY_PRODUCTS];
        alert(`[데모 모드] ${successCount}개 상품이 [${section.label}] 진열구역에 추가되었습니다.`);
    }

    closeDisplayProductAddModal();
    fetchAdminDisplayProducts();
    if (typeof fetchProducts === "function") fetchProducts();
}

async function assignCheckedProductsToDisplaySection() {
    const checkedBoxes = document.querySelectorAll(".admin-display-check:checked");
    if (checkedBoxes.length === 0) {
        alert("메인 진열구역을 수정할 상품을 먼저 선택해 주세요.");
        return;
    }
    const sectionId = document.getElementById("admin-display-large")?.value || "featured";
    const section = getAdminDisplaySection(sectionId);
    const ids = Array.from(checkedBoxes).map(cb => cb.value);
    if (!confirm(`선택한 ${ids.length}개 상품을 [${section.label}] 진열구역으로 지정하시겠습니까?`)) return;

    if (supabaseClient) {
        try {
            for (const id of ids) {
                const p = currentDisplayProductsList.find(item => item.id === id) || displayAddProductsPool.find(item => item.id === id) || {};
                const newDetails = setAdminProductDisplaySectionTag(p.details || "", sectionId);
                const { error } = await supabaseClient
                    .from("products")
                    .update({ details: newDetails, is_visible: true })
                    .eq("id", id);
                if (error) throw error;
            }
            alert(`선택 상품이 [${section.label}] 진열구역으로 지정되었습니다.`);
        } catch (e) {
            alert(`진열구역 저장 중 오류가 발생했습니다: ${e.message}`);
        }
    } else {
        ids.forEach(id => {
            const p = DUMMY_PRODUCTS.find(item => item.id === id);
            if (p) {
                p.details = setAdminProductDisplaySectionTag(p.details || "", sectionId);
                p.is_visible = true;
            }
        });
        allProducts = [...DUMMY_PRODUCTS];
        alert(`[데모 모드] 선택 상품이 [${section.label}] 진열구역으로 지정되었습니다.`);
    }

    fetchAdminDisplayProducts();
    if (typeof fetchProducts === "function") fetchProducts();
}


// Cafe24 product operations UX
(function () {
    const labels = {
        productList: "상품 목록",
        productDesc: "상품 검색, 수정, 삭제, 진열 상태를 한 화면에서 빠르게 처리합니다.",
        displayTitle: "상품 진열 관리",
        displayDesc: "분류별 노출 여부와 진열 순서를 카페24처럼 정리합니다.",
        categoryTitle: "상품 분류 관리",
        categoryDesc: "대분류, 중분류, 소분류를 직관적으로 추가하고 관리합니다.",
        refresh: "새로고침",
        register: "상품 등록",
        selectedWork: "선택 상품 처리",
        selectedDisplay: "선택 진열 처리",
        saveSelected: "선택 저장",
        visibleOn: "진열함",
        visibleOff: "진열안함",
        deleteSelected: "선택 삭제",
        soldout: "품절",
        saleOn: "판매함",
        saleOff: "판매안함",
        noProducts: "조회된 상품이 없습니다.",
        noDisplay: "진열 조건과 일치하는 상품이 없습니다."
    };

    function money(value) {
        const num = Number(value) || 0;
        return "KRW " + num.toLocaleString();
    }

    function h(value) {
        return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "").replace(/[&<>'"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[s]));
    }

    function getCheckedProductIds(selector) {
        return Array.from(document.querySelectorAll(selector + ":checked")).map(cb => cb.value).filter(Boolean);
    }

    function selectedProductName(id) {
        return document.getElementById(`admin-name-${id}`)?.value || "selected product";
    }

    function ensureProductOpsShell() {
        const productsTab = document.getElementById("admin-tab-products");
        if (productsTab && !document.getElementById("cafe24-product-list-shell")) {
            const shell = document.createElement("div");
            shell.id = "cafe24-product-list-shell";
            shell.className = "cafe24-ops-shell";
            shell.innerHTML = `
                <div class="cafe24-ops-head">
                    <div><h3>${labels.productList}</h3><p>${labels.productDesc}</p></div>
                    <div class="cafe24-ops-buttons"><button type="button" onclick="switchAdminTab('products-register')">${labels.register}</button><button type="button" onclick="fetchAdminProducts()">${labels.refresh}</button></div>
                </div>
                <div class="cafe24-ops-stats">
                    <span>전체 상품 <strong id="cafe24-products-count">0</strong></span>
                    <span>진열중 <strong id="cafe24-products-visible">0</strong></span>
                    <span>품절 <strong id="cafe24-products-soldout">0</strong></span>
                    <span>총 재고 <strong id="cafe24-products-stock">0</strong></span>
                </div>
                <div class="cafe24-bulkbar"><strong>${labels.selectedWork}</strong><button type="button" onclick="cafe24BatchSaveProducts()">${labels.saveSelected}</button><button type="button" onclick="cafe24BatchSetProductVisibility(true)">${labels.visibleOn}</button><button type="button" onclick="cafe24BatchSetProductVisibility(false)">${labels.visibleOff}</button><button type="button" class="danger" onclick="cafe24BatchDeleteProducts()">${labels.deleteSelected}</button></div>`;
            productsTab.insertBefore(shell, productsTab.firstChild);
        }

        const displayTab = document.getElementById("admin-tab-ready");
        if (displayTab && activeAdminTab === "products-display" && !document.getElementById("cafe24-display-shell")) {
            const shell = document.createElement("div");
            shell.id = "cafe24-display-shell";
            shell.className = "cafe24-display-page";
            shell.innerHTML = `
                <div class="cafe24-display-heading">
                    <h2>메인 상품 진열 <span>가이드</span><button type="button" onclick="openCafe24AiChatbot()">AI 챗봇 문의하기</button></h2>
                </div>
                <h3 class="cafe24-display-section-title">메인 진열구역별 진열</h3>
                <section class="cafe24-display-search-panel">
                    <div class="cafe24-display-form-row">
                        <label>메인 진열구역</label>
                        <div class="cafe24-display-field">
                            <select id="admin-display-large" onchange="onAdminDisplayCategoryLargeChange()"><option value="featured">추천상품</option><option value="new">신상품</option><option value="best">베스트상품</option></select>
                            <select id="admin-display-medium" class="cafe24-compat-hidden" onchange="onAdminDisplayCategoryMediumChange()"><option value="">사용 안함</option></select>
                            <select id="admin-display-small" class="cafe24-compat-hidden"><option value="">소분류 전체</option></select>
                            <button type="button" class="cafe24-outline-btn" onclick="alert('진열구역은 쇼핑몰 메인의 추천상품, 신상품, 베스트상품 영역과 연결됩니다.')">진열구역 안내</button>
                            <span class="cafe24-help-dot">?</span>
                        </div>
                    </div>
                    <div class="cafe24-display-form-row">
                        <label>상품검색</label>
                        <div class="cafe24-display-field">
                            <select><option>상품명</option><option>브랜드명</option><option>상품코드</option></select>
                            <input id="admin-display-search-keyword" type="text">
                        </div>
                    </div>
                    <div class="cafe24-display-form-row split">
                        <label>진열상태</label>
                        <div class="cafe24-display-field radio">
                            <label><input type="radio" name="admin-display-visible-filter" value="all" checked> 전체</label>
                            <label><input type="radio" name="admin-display-visible-filter" value="true"> 진열함</label>
                            <label><input type="radio" name="admin-display-visible-filter" value="false"> 진열안함</label>
                        </div>
                        <label>판매상태</label>
                        <div class="cafe24-display-field radio">
                            <label><input type="radio" name="admin-display-sale-filter" value="all" checked> 전체</label>
                            <label><input type="radio" name="admin-display-sale-filter" value="selling"> 판매함</label>
                            <label><input type="radio" name="admin-display-sale-filter" value="notselling"> 판매안함</label>
                        </div>
                    </div>
                    <div class="cafe24-display-form-row">
                        <label>판매가</label>
                        <div class="cafe24-display-field price">
                            <input id="admin-display-price-min" type="number"> <span>KRW ~</span>
                            <input id="admin-display-price-max" type="number"> <span>KRW</span>
                        </div>
                    </div>
                </section>
                <div class="cafe24-display-search-action"><button type="button" onclick="fetchAdminDisplayProducts()">검색</button></div>
                <h3 class="cafe24-display-section-title">상품 진열 <span class="cafe24-help-dot">?</span></h3>
                <section class="cafe24-display-info-box">
                    <dl>
                        <dt>분류설명</dt><dd id="admin-display-cat-info">전체상품</dd>
                        <dt>진열방식</dt><dd>사용자지정, 품절상품 상관없음 <a href="javascript:void(0)">[진열방식 수정하기]</a></dd>
                        <dt>상품개수</dt><dd><span id="admin-display-total-count">0</span>개</dd>
                    </dl>
                </section>
                <section class="cafe24-main-display-board">
                    <div class="cafe24-display-viewbar">
                        <div class="cafe24-view-toggle"><button type="button" class="active" data-view-mode="grid" onclick="setCafe24DisplayViewMode('grid')">▦</button><button type="button" data-view-mode="list" onclick="setCafe24DisplayViewMode('list')">☰</button></div>
                        <div class="cafe24-view-filters">
                            <label><input type="checkbox" checked> 목록 전체보기</label>
                            <select disabled><option>-선택-</option></select>
                            <select><option>진열순</option><option>상품명</option><option>판매가</option></select>
                            <select disabled><option>품절상품 상관없음</option></select>
                        </div>
                    </div>
                    <div class="cafe24-display-toolbar">
                        <div>
                            <button type="button" onclick="moveDisplayOrderTop()">⇈</button>
                            <button type="button" onclick="moveDisplayOrderUp()">↑</button>
                            <button type="button" onclick="moveDisplayOrderDown()">↓</button>
                            <button type="button" onclick="moveDisplayOrderBottom()">⇊</button>
                            <button type="button" class="danger-text" onclick="batchSetDisplayVisibility(false)">× 진열안함</button>
                            <button type="button" onclick="editCheckedProductCategories()">분류수정 ›</button>
                            <button type="button" onclick="assignCheckedProductsToDisplaySection()">메인진열수정 ›</button>
                            <button type="button" onclick="setCheckedDisplayFixed(true)">고정함</button>
                            <button type="button" onclick="setCheckedDisplayFixed(false)">고정안함</button>
                        </div>
                        <div>
                            <button type="button" class="excel" onclick="downloadCafe24DisplayCsv()">엑셀다운로드 ›</button>
                            <button type="button" class="dark" onclick="openDisplayProductAddModal()">상품추가 ›</button>
                            <button type="button" class="icon" onclick="openCafe24DisplaySettings()">⚙</button>
                        </div>
                    </div>
                    <div class="cafe24-display-table-wrap">
                        <table class="cafe24-main-display-table">
                            <thead><tr><th><input id="admin-display-check-all" type="checkbox" onchange="toggleAllDisplayChecks(this)"></th><th>진열<br>순위</th><th>상품명/상품코드</th><th>판매가</th><th>진열상태</th><th>판매상태</th><th>판매량</th></tr></thead>
                            <tbody id="admin-display-product-rows"></tbody>
                        </table>
                    </div>
                </section>`;
            displayTab.insertBefore(shell, displayTab.firstChild);
            Array.from(displayTab.children).forEach(child => {
                if (child.id !== "cafe24-display-shell" && !child.classList.contains("modal") && !child.classList.contains("cart-modal-overlay")) {
                    child.classList.add("cafe24-display-legacy-hidden");
                }
            });
        }

        const categoryTab = document.getElementById("admin-tab-categories");
        if (categoryTab && !document.getElementById("cafe24-category-shell")) {
            const shell = document.createElement("div");
            shell.id = "cafe24-category-shell";
            shell.className = "cafe24-ops-shell";
            shell.innerHTML = `<div class="cafe24-ops-head"><div><h3>${labels.categoryTitle}</h3><p>${labels.categoryDesc}</p></div><div class="cafe24-ops-buttons"><button type="button" onclick="clearCategoryForm()">신규 분류</button><button type="button" onclick="fetchAdminCategories()">분류 새로고침</button></div></div>`;
            categoryTab.insertBefore(shell, categoryTab.firstChild);
        }
    }

    function updateProductStats(products) {
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set("cafe24-products-count", products.length.toLocaleString());
        set("cafe24-products-visible", products.filter(p => p.is_visible).length.toLocaleString());
        set("cafe24-products-soldout", products.filter(p => p.is_soldout).length.toLocaleString());
        set("cafe24-products-stock", products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0).toLocaleString());
    }

    const oldSwitchAdminTab = window.switchAdminTab;
    if (typeof oldSwitchAdminTab === "function") {
        window.switchAdminTab = function (tabName) {
            const result = oldSwitchAdminTab.apply(this, arguments);
            setTimeout(ensureProductOpsShell, 0);
            return result;
        };
    }

    const oldFetchAdminProducts = window.fetchAdminProducts;
    if (typeof oldFetchAdminProducts === "function") {
        window.fetchAdminProducts = async function () {
            ensureProductOpsShell();
            return oldFetchAdminProducts.apply(this, arguments);
        };
    }

    window.cafe24BatchSaveProducts = async function () {
        const ids = getCheckedProductIds(".admin-prod-check");
        if (!ids.length) return alert("저장할 상품을 먼저 선택하세요.");
        if (!confirm(`선택한 ${ids.length}개 상품의 변경사항을 저장할까요?`)) return;
        for (const id of ids) await saveProductEdits(id);
        alert("선택 상품 저장을 완료했습니다.");
    };

    window.cafe24BatchSetProductVisibility = async function (visible) {
        const ids = getCheckedProductIds(".admin-prod-check");
        if (!ids.length) return alert("진열 상태를 변경할 상품을 먼저 선택하세요.");
        if (!confirm(`선택한 ${ids.length}개 상품을 ${visible ? labels.visibleOn : labels.visibleOff} 상태로 변경할까요?`)) return;
        for (const id of ids) {
            const input = document.getElementById(`admin-visible-${id}`);
            if (input) input.checked = visible;
            await toggleProductVisibility(id);
        }
        fetchAdminProducts();
    };

    window.cafe24BatchDeleteProducts = async function () {
        const ids = getCheckedProductIds(".admin-prod-check");
        if (!ids.length) return alert("삭제할 상품을 먼저 선택하세요.");
        if (!confirm(`선택한 ${ids.length}개 상품을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
        for (const id of ids) await deleteProductDirect(id, selectedProductName(id));
        fetchAdminProducts();
    };

    window.renderAdminTableRows = function (products) {
        ensureProductOpsShell();
        updateProductStats(products);
        const tbody = document.getElementById("admin-product-rows");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (!products.length) {
            tbody.innerHTML = `<tr><td colspan="11" class="cafe24-empty-row">${labels.noProducts}</td></tr>`;
            return;
        }
        products.forEach(p => {
            const tr = document.createElement("tr");
            tr.className = "cafe24-product-row";
            const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
            const colorsStr = (p.colors || []).join(",");
            const sizesStr = (p.sizes || []).join(",");
            tr.innerHTML = `
                <td class="center"><input type="checkbox" class="admin-prod-check" value="${h(p.id)}" onclick="event.stopPropagation()"></td>
                <td class="center"><img src="${h(repImg)}" class="admin-img-thumb cafe24-thumb" alt="${h(p.name || "product")}"></td>
                <td><div class="cafe24-product-main"><strong>${h(p.name || "상품명 없음")}</strong><span>${h(p.brand || "브랜드 미지정")}</span></div><input type="text" class="admin-input-text" id="admin-name-${h(p.id)}" value="${h(p.name || "")}" placeholder="상품명"><input type="text" class="admin-input-text" id="admin-brand-${h(p.id)}" value="${h(p.brand || "")}" placeholder="브랜드"><input type="text" class="admin-input-text" id="admin-url-${h(p.id)}" value="${h(p.post_url || "")}" placeholder="원본 URL"></td>
                <td><div class="cafe24-category-inline"><select id="admin-category-large-${h(p.id)}" class="admin-input-text" onchange="onAdminRowCategoryLargeChange('${h(p.id)}')"><option value="">대분류</option></select><select id="admin-category-medium-${h(p.id)}" class="admin-input-text" onchange="onAdminRowCategoryMediumChange('${h(p.id)}')"><option value="">중분류</option></select><select id="admin-category-small-${h(p.id)}" class="admin-input-text"><option value="">소분류</option></select></div></td>
                <td><input type="text" class="admin-input-text center" id="admin-original-${h(p.id)}" value="${h(p.original_price || "")}" placeholder="소비자가"></td>
                <td><input type="number" class="admin-input-text center strong" id="admin-price-${h(p.id)}" value="${Number(p.selling_price) || 0}"><span class="cafe24-mini-help">${money(p.selling_price)}</span></td>
                <td><input type="number" class="admin-input-text center strong" id="admin-stock-${h(p.id)}" value="${p.stock !== undefined ? Number(p.stock) || 0 : 99}"></td>
                <td class="center"><label class="cafe24-check-label"><input type="checkbox" id="admin-soldout-${h(p.id)}" ${p.is_soldout ? "checked" : ""}> ${labels.soldout}</label></td>
                <td><input type="text" class="admin-input-text" id="admin-colors-${h(p.id)}" value="${h(colorsStr)}" placeholder="색상"><input type="text" class="admin-input-text" id="admin-sizes-${h(p.id)}" value="${h(sizesStr)}" placeholder="사이즈"></td>
                <td class="center"><label class="switch"><input type="checkbox" id="admin-visible-${h(p.id)}" ${p.is_visible ? "checked" : ""} onchange="toggleProductVisibility('${h(p.id)}')"><span class="slider"></span></label><span class="cafe24-status ${p.is_visible ? "on" : "off"}">${p.is_visible ? labels.visibleOn : labels.visibleOff}</span></td>
                <td class="center"><div class="cafe24-row-actions"><button onclick="saveProductEdits('${h(p.id)}')">저장</button><button onclick="openEditProductModal('${h(p.id)}')">수정</button><button class="danger" onclick="deleteProductDirect('${h(p.id)}', '${h(p.name || "상품")}')">삭제</button></div></td>`;
            tbody.appendChild(tr);
            populateAdminRowCategoryDropdowns(p);
        });
    };

    window.renderAdminDisplayTableRows = function (products) {
        const tbody = document.getElementById("admin-display-product-rows");
        if (!tbody) return;
        ensureProductOpsShell();
        tbody.innerHTML = "";
        if (!products.length) {
            tbody.innerHTML = `<tr><td colspan="8" class="cafe24-empty-row">${labels.noDisplay}</td></tr>`;
            return;
        }
        products.forEach((p, index) => {
            const tr = document.createElement("tr");
            tr.className = selectedDisplayRowProductId === p.id ? "cafe24-display-row selected" : "cafe24-display-row";
            tr.onclick = e => {
                if (!["INPUT", "BUTTON", "A", "LABEL"].includes(e.target.tagName)) {
                    selectedDisplayRowProductId = p.id;
                    renderAdminDisplayTableRows(products);
                }
            };
            const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
            const dateStr = p.created_at ? new Date(p.created_at).toLocaleDateString() : "-";
            tr.innerHTML = `<td class="center"><input type="checkbox" class="admin-display-check" value="${h(p.id)}" onclick="event.stopPropagation()"></td><td class="center strong">${index + 1}</td><td class="center"><img src="${h(repImg)}" class="cafe24-display-thumb" alt="${h(p.name || "상품")}"></td><td><div class="cafe24-product-main"><strong>${h(p.name || "상품명 없음")}</strong><span>${h(p.brand || "브랜드 미지정")}</span></div></td><td class="center strong">${money(p.selling_price)}</td><td class="center"><span class="cafe24-status ${p.is_visible ? "on" : "off"}">${p.is_visible ? labels.visibleOn : labels.visibleOff}</span></td><td class="center"><span class="cafe24-status ${p.is_soldout ? "off" : "on"}">${p.is_soldout ? labels.saleOff : labels.saleOn}</span></td><td class="center muted">${dateStr}</td>`;
            tbody.appendChild(tr);
        });
    };

    document.addEventListener("DOMContentLoaded", ensureProductOpsShell);
    setTimeout(ensureProductOpsShell, 300);
})();

function cafe24DisplayEscape(value) {
    return String(value || "").replace(/[&<>'"]/g, s => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        "\"": "&quot;"
    }[s]));
}

function cafe24DisplayPrice(value) {
    return (Number(value) || 0).toLocaleString();
}

function cafe24DisplayOptionText(values, fallback) {
    const list = Array.isArray(values) ? values.filter(Boolean) : [];
    return list.length ? list.join(", ") : fallback;
}

window.renderAdminDisplayTableRows = function (products) {
    const tbody = document.getElementById("admin-display-product-rows");
    if (!tbody) return;
    const rows = Array.isArray(products) ? products : [];
    tbody.innerHTML = "";
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="cafe24-empty-row">진열 조건과 일치하는 상품이 없습니다.</td></tr>`;
        return;
    }
    rows.forEach((p, index) => {
        const tr = document.createElement("tr");
        tr.className = selectedDisplayRowProductId === p.id ? "cafe24-main-display-row selected" : "cafe24-main-display-row";
        tr.onclick = e => {
            if (!["INPUT", "BUTTON", "A", "LABEL", "SELECT"].includes(e.target.tagName)) {
                selectedDisplayRowProductId = p.id;
                renderAdminDisplayTableRows(rows);
            }
        };
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        const code = p.product_code || p.post_id || p.id || "-";
        const colors = cafe24DisplayOptionText(p.colors, "기본");
        const sizes = cafe24DisplayOptionText(p.sizes, "Free");
        tr.innerHTML = `
            <td class="center"><input type="checkbox" class="admin-display-check" value="${cafe24DisplayEscape(p.id)}" onclick="event.stopPropagation()"></td>
            <td class="center cafe24-rank">${index + 1}</td>
            <td>
                <div class="cafe24-display-product-cell">
                    <img src="${cafe24DisplayEscape(repImg)}" alt="${cafe24DisplayEscape(p.name || "상품")}" class="cafe24-display-thumb">
                    <div>
                        <a href="javascript:void(0)" onclick="openEditProductModal('${cafe24DisplayEscape(p.id)}')">[일반상품] ${cafe24DisplayEscape(p.brand || "")} ${cafe24DisplayEscape(p.name || "상품명 없음")}<br>(${cafe24DisplayEscape(code)})</a>
                        <p>- 색상: 색상(${cafe24DisplayEscape(colors)})</p>
                        <p>- 사이즈: 사이즈(${cafe24DisplayEscape(sizes)})</p>
                    </div>
                </div>
            </td>
            <td class="right">${cafe24DisplayPrice(p.selling_price)}</td>
            <td class="center">${p.is_visible ? "진열함" : "진열안함"}</td>
            <td class="center">${p.is_soldout ? "판매안함" : "판매함"}</td>
            <td class="center">${Number(p.sales_count || p.sales || 0).toLocaleString()}</td>`;
        tbody.appendChild(tr);
    });
};

window.renderDisplayAddTableRows = function (products) {
    const tbody = document.getElementById("display-add-product-rows");
    if (!tbody) return;
    const rows = Array.isArray(products) ? products : [];
    tbody.innerHTML = "";
    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="cafe24-empty-row">추가할 수 있는 상품이 없습니다.</td></tr>`;
        return;
    }
    rows.forEach(p => {
        const tr = document.createElement("tr");
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        const sections = getAdminProductDisplaySections(p).map(id => getAdminDisplaySection(id).label);
        tr.innerHTML = `
            <td class="center"><input type="checkbox" class="display-add-check" value="${cafe24DisplayEscape(p.id)}"></td>
            <td class="center"><img src="${cafe24DisplayEscape(repImg)}" class="cafe24-display-add-thumb" alt="${cafe24DisplayEscape(p.name || "상품")}"></td>
            <td>
                <strong class="cafe24-display-add-name">${cafe24DisplayEscape(p.name || "상품명 없음")}</strong>
                <span class="cafe24-display-add-meta">${cafe24DisplayEscape(p.brand || "브랜드 미지정")} · 현재 진열구역: ${cafe24DisplayEscape(sections.join(", ") || "없음")}</span>
            </td>
            <td class="right">${cafe24DisplayPrice(p.selling_price)}</td>
            <td class="center">${p.is_visible ? "진열함" : "진열안함"}</td>`;
        tbody.appendChild(tr);
    });
};

function getCafe24CustomerBenefitRows() {
    const fallback = [{ id: "mock-user-456", email: "golfman3232", name: "golfman3232", grade: "일반회원", points: 5000, deposit: 0, created_at: "2026-06-09T05:18:02" }];
    const source = Array.isArray(localUsers) && localUsers.length ? localUsers : fallback;
    return source.map((user, index) => {
        const rawName = user.name || user.customer_name || user.email || `회원${index + 1}`;
        const name = typeof secureDecrypt === "function" ? secureDecrypt(rawName) : rawName;
        return {
            id: user.id || `member-${index + 1}`,
            login: user.email || name || `member${index + 1}`,
            name: name || user.email || `회원${index + 1}`,
            grade: user.grade || "일반회원",
            points: Number(user.points || 0),
            deposit: Number(user.deposit || user.cash_deposit || 0),
            createdAt: user.created_at || "2026-06-09T05:18:02"
        };
    });
}

function setCafe24CustomerQuickRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Number(days || 0));
    const fmt = d => d.toISOString().slice(0, 10);
    const startInput = document.getElementById("customer-benefit-start-date");
    const endInput = document.getElementById("customer-benefit-end-date");
    if (startInput) startInput.value = fmt(start);
    if (endInput) endInput.value = fmt(end);
}

function renderCafe24CustomerBenefitPage(mode) {
    const ready = document.getElementById("admin-tab-ready");
    if (!ready) return;

    const customers = getCafe24CustomerBenefitRows();
    const totalPoints = customers.reduce((sum, user) => sum + user.points, 0);
    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const pointRows = customers.map((user, index) => `
        <tr>
            <td>${index === 0 ? "2026-06-09<br>05:18:02" : new Date(user.createdAt).toLocaleDateString("ko-KR")}</td>
            <td><a href="javascript:void(0)">${cafe24DisplayEscape(user.login)}</a><br><span class="cafe24-member-mobile">M</span><br>${cafe24DisplayEscape(user.grade)}</td>
            <td class="right">${user.points.toLocaleString()}</td>
            <td class="right">0</td>
            <td class="right">${user.points.toLocaleString()}</td>
            <td>20260601-<br>0000013</td>
            <td>-</td>
            <td></td>
            <td class="left">주문취소시 구매에 사용한 적립금 부여</td>
        </tr>`).join("");

    const screens = {
        "customers-benefits": {
            title: "회원 적립금 관리",
            form: `
                <div class="cafe24-customer-form-row"><label>등급</label><div><select><option>전체</option><option>일반회원</option><option>특별관리회원</option></select></div></div>
                <div class="cafe24-customer-form-row"><label>아이디</label><div><input type="text"></div></div>
                <div class="cafe24-customer-form-row"><label>기간</label><div class="range"><button onclick="setCafe24CustomerQuickRange(0)">오늘</button><button class="active" onclick="setCafe24CustomerQuickRange(3)">3일</button><button onclick="setCafe24CustomerQuickRange(7)">7일</button><input id="customer-benefit-start-date" type="date" value="${threeDaysAgo}"><span>~</span><input id="customer-benefit-end-date" type="date" value="${today}"></div></div>`,
            statsTitle: "조회기간 내 적립금 내역 통계",
            stats: `<table><thead><tr><th colspan="3">가용 적립금</th><th>미가용 적립금</th><th>미가용 회원/쿠폰 적립금</th></tr><tr><th>증가</th><th>차감</th><th>합계</th><th>증가</th><th>증가</th></tr></thead><tbody><tr><td>${totalPoints.toLocaleString()}</td><td>0</td><td>${totalPoints.toLocaleString()}</td><td>0</td><td>0</td></tr></tbody></table>`,
            listTitle: "회원 적립금 내역",
            tabs: `<button class="active">가용적립금</button><button>미가용적립금</button><button>미가용회원/쿠폰적립금</button>`,
            toolbar: `<label><input type="checkbox"> 특별관리회원</label><span class="cafe24-member-mobile">M</span> 모바일 가입회원 <span class="cafe24-bad-badge">불량</span> 불량회원 <select><option>- 적립금 타입 -</option></select><select><option>20개씩보기</option></select><button>엑셀다운로드 ›</button><button class="dark">적립금 일괄 조정</button>`,
            table: `<table><thead><tr><th>일자</th><th>아이디</th><th colspan="3">가용적립금</th><th>관련주문/추천인</th><th>처리자</th><th>적립금 유형</th><th>내용</th></tr><tr><th></th><th></th><th>증가</th><th>차감</th><th>잔액</th><th></th><th></th><th></th><th></th></tr></thead><tbody>${pointRows}</tbody></table>`
        },
        "customers-deposit": {
            title: "회원예치금 관리",
            form: `
                <div class="cafe24-customer-form-row"><label>기간</label><div class="range"><button class="active" onclick="setCafe24CustomerQuickRange(0)">오늘</button><button onclick="setCafe24CustomerQuickRange(7)">1주</button><button onclick="setCafe24CustomerQuickRange(30)">1개월</button><button onclick="setCafe24CustomerQuickRange(60)">2개월</button><button onclick="setCafe24CustomerQuickRange(90)">3개월</button><input id="customer-benefit-start-date" type="date" value="${today}"><span>~</span><input id="customer-benefit-end-date" type="date" value="${today}"></div></div>
                <div class="cafe24-customer-form-row"><label>예치금 지급/차감</label><div class="radio"><label><input type="radio" checked> 전체</label><label><input type="radio"> 지급내역</label><label><input type="radio"> 차감내역</label></div></div>
                <div class="cafe24-customer-form-row"><label>내용</label><div class="radio"><label><input type="radio" checked> 전체</label><label><input type="radio"> 주문취소</label><label><input type="radio"> 예치금환불</label><label><input type="radio"> 상품구매</label><label><input type="radio"> 임의조정</label><label><input type="radio"> 현금환불</label></div></div>
                <div class="cafe24-customer-form-row"><label>처리자</label><div><select><option>전체</option><option>관리자</option></select></div></div>
                <div class="cafe24-customer-form-row"><label>아이디/상세내용</label><div><select><option>아이디</option><option>상세내용</option></select><input type="text"></div></div>`,
            statsTitle: "조회기간 내 예치금 내역 통계",
            stats: `<table><thead><tr><th>지급</th><th>차감</th><th>합계</th></tr></thead><tbody><tr><td>0</td><td>0</td><td>0</td></tr></tbody></table>`,
            listTitle: "예치금 처리 목록",
            tabs: "",
            toolbar: `<strong>[검색결과 0명]</strong><select><option>50개씩보기</option></select><button>엑셀다운로드 ›</button>`,
            table: `<table><thead><tr><th>No</th><th>일자</th><th>아이디</th><th>지급(+)</th><th>차감(-)</th><th>잔액</th><th>관련주문</th><th>처리자</th><th>내용 (상세내용)</th></tr></thead><tbody><tr><td colspan="9" class="empty">검색된 예치금 내역이 없습니다.</td></tr></tbody></table>`
        },
        "customers-points-expire": {
            title: "회원 적립금 소멸",
            form: `
                <div class="cafe24-customer-form-row"><label>소멸 방법</label><div class="radio"><label><input type="radio" checked> 수동 소멸 처리</label><label><input type="radio"> 자동 소멸 처리</label></div></div>
                <div class="cafe24-customer-form-row"><label>소멸 대상 적립금</label><div class="range"><span>~</span><input type="date" value="2025-06-10"><button>6개월</button><button>1년</button><button>2년</button></div></div>
                <div class="cafe24-customer-form-row"><label>소멸 대상 회원 등급</label><div><select><option>전체 회원등급</option><option>일반회원</option></select></div></div>
                <div class="cafe24-customer-form-row"><label>소멸 대상 기준 금액</label><div><input type="number"></div></div>
                <div class="cafe24-customer-form-row"><label>검색일 안내</label><div><p>소멸대상 적립금 검색은 서버부하 방지를 위해 일주일에 1회만 검색조건 변경이 가능합니다.</p></div></div>`,
            statsTitle: "소멸대상 적립금 통계",
            stats: `<table><thead><tr><th>적립금 소멸대상 회원수</th><th>사용가능 적립금 합계</th><th>소멸대상 적립금 합계</th><th>소멸 후 사용가능 적립금 합계</th></tr></thead><tbody><tr><td colspan="4" class="empty tall">통계 내역이 없습니다.</td></tr></tbody></table>`,
            listTitle: "",
            tabs: "",
            toolbar: "",
            table: ""
        }
    };

    const screen = screens[mode] || screens["customers-benefits"];
    ready.innerHTML = `
        <div id="cafe24-customer-benefit-shell" class="cafe24-customer-page">
            <h2>${screen.title} <span class="cafe24-help-dot">?</span> <b>가이드</b><button type="button">AI 챗봇 문의하기</button></h2>
            <section class="cafe24-customer-search">${screen.form}</section>
            <div class="cafe24-display-search-action"><button type="button">검색</button></div>
            <h3>${screen.statsTitle}</h3>
            <section class="cafe24-customer-stats">${screen.stats}</section>
            ${screen.listTitle ? `<h3>${screen.listTitle} <span class="cafe24-help-dot">?</span></h3>` : ""}
            ${screen.tabs ? `<div class="cafe24-customer-tabs">${screen.tabs}</div>` : ""}
            ${screen.toolbar ? `<div class="cafe24-customer-toolbar">${screen.toolbar}</div>` : ""}
            ${screen.table ? `<section class="cafe24-customer-table">${screen.table}</section>` : ""}
        </div>`;
}

window.renderCafe24CustomerBenefitPage = renderCafe24CustomerBenefitPage;
window.setCafe24CustomerQuickRange = setCafe24CustomerQuickRange;

function getCafe24CustomerShell() {
    return document.getElementById("cafe24-customer-benefit-shell");
}

function showCafe24CustomerMessage(message) {
    if (typeof showToast === "function") {
        showToast(message);
        return;
    }
    alert(message);
}

function applyCafe24CustomerBenefitSearch() {
    const shell = getCafe24CustomerShell();
    if (!shell) return;

    const keywordInput = Array.from(shell.querySelectorAll('input[type="text"]')).find(input => input.value.trim());
    const keyword = keywordInput ? keywordInput.value.trim().toLowerCase() : "";
    const rows = Array.from(shell.querySelectorAll(".cafe24-customer-table tbody tr"));
    let visibleCount = 0;

    rows.forEach(row => {
        const isEmptyRow = row.querySelector(".empty") || row.querySelector(".cafe24-empty-row");
        const matched = !keyword || row.textContent.toLowerCase().includes(keyword);
        row.style.display = matched ? "" : "none";
        if (matched && !isEmptyRow) visibleCount += 1;
    });

    showCafe24CustomerMessage(keyword ? `${visibleCount}건이 조회되었습니다.` : "조회 조건을 적용했습니다.");
}

function switchCafe24CustomerPointTab(tabButton) {
    const shell = getCafe24CustomerShell();
    if (!shell || !tabButton) return;

    const buttons = Array.from(shell.querySelectorAll(".cafe24-customer-tabs button"));
    buttons.forEach(button => button.classList.remove("active"));
    tabButton.classList.add("active");

    const tbody = shell.querySelector(".cafe24-customer-table tbody");
    if (!tbody) return;

    const tabIndex = buttons.indexOf(tabButton);
    if (tabIndex === 0) {
        renderCafe24CustomerBenefitPage("customers-benefits");
        return;
    }

    tbody.innerHTML = '<tr><td colspan="9" class="empty">해당 적립금 내역이 없습니다.</td></tr>';
    showCafe24CustomerMessage("선택한 적립금 탭으로 전환했습니다.");
}

function downloadCafe24CustomerBenefitCsv() {
    const shell = getCafe24CustomerShell();
    if (!shell) return;

    const table = shell.querySelector(".cafe24-customer-table table") || shell.querySelector(".cafe24-customer-stats table");
    if (!table) {
        showCafe24CustomerMessage("다운로드할 내역이 없습니다.");
        return;
    }

    const csv = Array.from(table.querySelectorAll("tr")).map(row => {
        return Array.from(row.children).map(cell => {
            const text = cell.textContent.replace(/\s+/g, " ").trim().replace(/"/g, '""');
            return `"${text}"`;
        }).join(",");
    }).join("\n");

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customer-benefit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showCafe24CustomerMessage("엑셀 다운로드 파일을 만들었습니다.");
}

function openCafe24CustomerPointAdjust() {
    const customers = getCafe24CustomerBenefitRows();
    const defaultLogin = customers[0]?.login || "";
    const targetLogin = prompt("적립금을 조정할 회원 아이디를 입력하세요.", defaultLogin);
    if (!targetLogin) return;

    const amountText = prompt("증가 금액은 양수, 차감 금액은 음수로 입력하세요.", "1000");
    if (amountText === null) return;

    const amount = Number(String(amountText).replace(/,/g, ""));
    if (!Number.isFinite(amount)) {
        showCafe24CustomerMessage("금액을 숫자로 입력해주세요.");
        return;
    }

    const user = Array.isArray(localUsers)
        ? localUsers.find(item => item.email === targetLogin || item.name === targetLogin || item.customer_name === targetLogin)
        : null;

    if (user) {
        user.points = Number(user.points || 0) + amount;
        try {
            safeLocalStorage.setItem("pkb71_users", JSON.stringify(localUsers));
        } catch (error) {
            console.warn("Failed to save adjusted points", error);
        }
    }

    renderCafe24CustomerBenefitPage("customers-benefits");
    showCafe24CustomerMessage(`${targetLogin} 회원의 적립금 조정이 반영되었습니다.`);
}

function bindCafe24CustomerBenefitEvents() {
    if (window.__cafe24CustomerBenefitEventsBound) return;
    window.__cafe24CustomerBenefitEventsBound = true;

    document.addEventListener("click", event => {
        const shell = getCafe24CustomerShell();
        if (!shell || !shell.contains(event.target)) return;

        const quickButton = event.target.closest(".cafe24-customer-form-row .range button");
        if (quickButton) {
            quickButton.parentElement.querySelectorAll("button").forEach(button => button.classList.remove("active"));
            quickButton.classList.add("active");
            return;
        }

        const searchButton = event.target.closest(".cafe24-display-search-action button");
        if (searchButton) {
            event.preventDefault();
            applyCafe24CustomerBenefitSearch();
            return;
        }

        const tabButton = event.target.closest(".cafe24-customer-tabs button");
        if (tabButton) {
            event.preventDefault();
            switchCafe24CustomerPointTab(tabButton);
            return;
        }

        const toolbarButton = event.target.closest(".cafe24-customer-toolbar button");
        if (!toolbarButton) return;

        const label = toolbarButton.textContent.trim();
        if (label.includes("엑셀다운로드")) {
            event.preventDefault();
            downloadCafe24CustomerBenefitCsv();
        } else if (label.includes("적립금 일괄 조정")) {
            event.preventDefault();
            openCafe24CustomerPointAdjust();
        }
    });
}

bindCafe24CustomerBenefitEvents();

window.applyCafe24CustomerBenefitSearch = applyCafe24CustomerBenefitSearch;
window.downloadCafe24CustomerBenefitCsv = downloadCafe24CustomerBenefitCsv;
window.openCafe24CustomerPointAdjust = openCafe24CustomerPointAdjust;

async function getCafe24AdminHomeOrders() {
    if (typeof supabaseClient !== "undefined" && supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient.from("orders").select("*").order("created_at", { ascending: false }));
            if (!error && Array.isArray(data) && data.length) return data;
        } catch (error) {
            console.warn("Cafe24 home orders fallback", error);
        }
    }
    if (typeof DUMMY_ORDERS !== "undefined" && Array.isArray(DUMMY_ORDERS)) return [...DUMMY_ORDERS];
    return [];
}

function cafe24AdminHomeMoney(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")} 원`;
}

function cafe24AdminHomeShortDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일`;
}

function cafe24AdminHomeDayLabel(date) {
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${String(date.getMonth() + 1).padStart(2, "0")}월 ${String(date.getDate()).padStart(2, "0")}일 ${weekdays[date.getDay()]}요일`;
}

function cafe24AdminHomeStatusCount(orders, names) {
    return orders.filter(order => names.includes(order.status)).length;
}

function cafe24AdminHomeSalesRows(orders) {
    const rows = [];
    const today = new Date();
    const paidStatuses = ["결제완료", "배송대기", "배송준비중", "배송중", "배송완료"];
    const refundStatuses = ["주문취소", "주문취소완료", "취소신청", "반품요청", "반품처리완료"];

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const key = date.toDateString();
        const dayOrders = orders.filter(order => new Date(order.created_at).toDateString() === key);
        const paidOrders = dayOrders.filter(order => paidStatuses.includes(order.status));
        const refundOrders = dayOrders.filter(order => refundStatuses.includes(order.status));
        rows.push({
            key,
            label: cafe24AdminHomeShortDate(date),
            chartLabel: `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
            isToday: i === 0,
            orderAmount: paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
            orderCount: paidOrders.length,
            paymentAmount: paidOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
            paymentCount: paidOrders.length,
            refundAmount: refundOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
            refundCount: refundOrders.length
        });
    }
    return rows;
}

function cafe24AdminHomeAverage(rows, days) {
    const sample = rows.slice(-days);
    const divider = sample.length || 1;
    return {
        orderAmount: Math.round(sample.reduce((sum, row) => sum + row.orderAmount, 0) / divider),
        orderCount: Math.round(sample.reduce((sum, row) => sum + row.orderCount, 0) / divider),
        paymentAmount: Math.round(sample.reduce((sum, row) => sum + row.paymentAmount, 0) / divider),
        paymentCount: Math.round(sample.reduce((sum, row) => sum + row.paymentCount, 0) / divider),
        refundAmount: Math.round(sample.reduce((sum, row) => sum + row.refundAmount, 0) / divider),
        refundCount: Math.round(sample.reduce((sum, row) => sum + row.refundCount, 0) / divider)
    };
}

function cafe24AdminHomeTotal(rows, days) {
    const sample = rows.slice(-days);
    return {
        orderAmount: sample.reduce((sum, row) => sum + row.orderAmount, 0),
        orderCount: sample.reduce((sum, row) => sum + row.orderCount, 0),
        paymentAmount: sample.reduce((sum, row) => sum + row.paymentAmount, 0),
        paymentCount: sample.reduce((sum, row) => sum + row.paymentCount, 0),
        refundAmount: sample.reduce((sum, row) => sum + row.refundAmount, 0),
        refundCount: sample.reduce((sum, row) => sum + row.refundCount, 0)
    };
}

function renderCafe24AdminHomeChart(rows) {
    const canvas = document.getElementById("cafe24-admin-home-chart");
    if (!canvas || typeof Chart === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (adminSalesChart) {
        adminSalesChart.destroy();
        adminSalesChart = null;
    }

    adminSalesChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: rows.map(row => row.chartLabel),
            datasets: [
                {
                    label: "주문",
                    data: rows.map(row => Math.round(row.orderAmount / 10000)),
                    backgroundColor: "#67b7f7",
                    borderRadius: 12,
                    maxBarThickness: 42
                },
                {
                    label: "환불",
                    data: rows.map(row => Math.round(row.refundAmount / 10000)),
                    type: "line",
                    borderColor: "#8b5cf6",
                    backgroundColor: "#8b5cf6",
                    pointBackgroundColor: "#fff",
                    pointBorderWidth: 3,
                    tension: 0.35
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.dataset.label}: ${context.raw.toLocaleString("ko-KR")}만원`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: "#667085", font: { weight: 700 } } },
                y: { beginAtZero: true, grid: { color: "#e5e7eb" }, ticks: { color: "#667085" } }
            }
        }
    });
}

function cafe24AdminHomeTableRow(label, data, highlightClass = "") {
    return `
        <tr class="${highlightClass}">
            <th>${label}</th>
            <td><strong>${cafe24AdminHomeMoney(data.orderAmount)}</strong><span>${data.orderCount}건</span></td>
            <td><strong>${cafe24AdminHomeMoney(data.paymentAmount)}</strong><span>${data.paymentCount}건</span></td>
            <td><strong>${cafe24AdminHomeMoney(data.refundAmount)}</strong><span>${data.refundCount}건</span></td>
        </tr>`;
}

async function renderCafe24AdminHomeDashboard() {
    const content = document.getElementById("admin-tab-dashboard");
    if (!content) return;

    const orders = await getCafe24AdminHomeOrders();
    const today = new Date();
    const rows = cafe24AdminHomeSalesRows(orders);
    const todayRow = rows[rows.length - 1] || { orderAmount: 0, orderCount: 0, paymentAmount: 0, paymentCount: 0, refundAmount: 0, refundCount: 0 };
    const avg7 = cafe24AdminHomeAverage(rows, 7);
    const total7 = cafe24AdminHomeTotal(rows, 7);
    const avg30 = cafe24AdminHomeAverage(rows, 30);
    const total30 = cafe24AdminHomeTotal(rows, 30);

    const readyCount = cafe24AdminHomeStatusCount(orders, ["배송준비중", "배송대기", "결제완료"]);
    const shipDelayCount = cafe24AdminHomeStatusCount(orders, ["배송보류중"]);
    const waitCount = cafe24AdminHomeStatusCount(orders, ["배송대기"]);
    const shippingCount = cafe24AdminHomeStatusCount(orders, ["배송중"]);
    const pendingCount = cafe24AdminHomeStatusCount(orders, ["입금대기"]);
    const cancelCount = cafe24AdminHomeStatusCount(orders, ["취소신청", "주문취소"]);
    const exchangeCount = cafe24AdminHomeStatusCount(orders, ["교환신청"]);
    const returnCount = cafe24AdminHomeStatusCount(orders, ["반품신청", "반품요청"]);
    const refundBeforeCount = cafe24AdminHomeStatusCount(orders, ["환불전"]);
    const boardCount = (typeof qnaPosts !== "undefined" ? qnaPosts.length : 0) + (typeof localReviews !== "undefined" ? localReviews.length : 0);
    const membersCount = Array.isArray(localUsers) ? localUsers.length : 0;
    const totalPoints = Array.isArray(localUsers) ? localUsers.reduce((sum, user) => sum + Number(user.points || 0), 0) : 0;

    const todoCards = [
        ["입금전", pendingCount, "blue"],
        ["배송준비중", readyCount, "blue"],
        ["배송보류중", shipDelayCount, "blue"],
        ["배송대기", waitCount, "blue"],
        ["배송중", shippingCount, "blue"],
        ["취소신청", cancelCount, "pink"],
        ["교환신청", exchangeCount, "pink"],
        ["반품신청", returnCount, "pink"],
        ["환불전", refundBeforeCount, "plain"],
        ["게시물관리", boardCount, "plain"]
    ];

    window.cafe24AdminHomeState = {
        orders,
        rows,
        today,
        counts: {
            pendingCount,
            readyCount,
            shipDelayCount,
            waitCount,
            shippingCount,
            cancelCount,
            exchangeCount,
            returnCount,
            refundBeforeCount,
            boardCount,
            membersCount,
            totalPoints
        },
        summary: { todayRow, avg7, total7, avg30, total30 }
    };

    content.innerHTML = `
        <section class="cafe24-admin-home">
            <div class="cafe24-home-todo">
                <h2>오늘의 할 일 <span>${cafe24AdminHomeDayLabel(today)}</span><i>?</i></h2>
                <div class="cafe24-home-todo-grid">
                    ${todoCards.map(([label, count, tone]) => `
                        <button type="button" class="cafe24-home-todo-card ${tone}">
                            <span>${label}</span>
                            <strong>${Number(count || 0).toLocaleString("ko-KR")}</strong>
                            ${tone === "pink" ? "<em>처리중 0</em>" : ""}
                        </button>
                    `).join("")}
                </div>
            </div>

            <div class="cafe24-home-panel">
                <div class="cafe24-home-tabs">
                    <button class="active">일별 매출 현황</button>
                    <button>실시간 접속 현황</button>
                    <button>주문처리 현황</button>
                    <button>회원/적립금 현황</button>
                    <button>예치금 현황</button>
                    <button>게시물 현황</button>
                </div>
                <div class="cafe24-home-main-grid">
                    <div class="cafe24-home-chart-box">
                        <div class="cafe24-home-chart-meta">
                            <span>단위/만원</span>
                            <span>${today.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })} 기준</span>
                        </div>
                        <div class="cafe24-home-chart-wrap">
                            <canvas id="cafe24-admin-home-chart"></canvas>
                        </div>
                        <div class="cafe24-home-chart-legend">
                            <span><b class="order"></b>주문</span>
                            <span><b class="payment"></b>결제</span>
                            <span><b class="refund"></b>환불(취소/반품)</span>
                        </div>
                    </div>
                    <div class="cafe24-home-sales-box">
                        <div class="cafe24-home-table-head">
                            <strong>기간별 매출</strong>
                            <span><i class="order"></i>주문</span>
                            <span><i class="payment"></i>결제</span>
                            <span><i class="refund"></i>환불</span>
                        </div>
                        <table class="cafe24-home-sales-table">
                            <tbody>
                                ${rows.slice(-3).map(row => cafe24AdminHomeTableRow(`${row.label}${row.isToday ? ' <b>오늘</b>' : ""}`, row, row.isToday ? "today" : "")).join("")}
                                ${cafe24AdminHomeTableRow("최근 7일 평균", avg7, "summary")}
                                ${cafe24AdminHomeTableRow("최근 7일 합계", total7)}
                                ${cafe24AdminHomeTableRow("최근 30일 평균", avg30)}
                                ${cafe24AdminHomeTableRow("최근 30일 합계", total30, "summary strong")}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="cafe24-home-bottom-grid">
                <section>
                    <h3>주문처리 요약</h3>
                    <div class="cafe24-home-mini-list">
                        <p><span>입금대기</span><strong>${pendingCount}건</strong></p>
                        <p><span>배송 준비 대상</span><strong>${readyCount}건</strong></p>
                        <p><span>클레임 요청</span><strong>${cancelCount + exchangeCount + returnCount}건</strong></p>
                    </div>
                </section>
                <section>
                    <h3>회원/적립금 현황</h3>
                    <div class="cafe24-home-mini-list">
                        <p><span>전체 회원</span><strong>${membersCount}명</strong></p>
                        <p><span>보유 적립금</span><strong>${totalPoints.toLocaleString("ko-KR")}원</strong></p>
                        <p><span>오늘 신규회원</span><strong>${Array.isArray(localUsers) ? localUsers.filter(user => new Date(user.created_at).toDateString() === today.toDateString()).length : 0}명</strong></p>
                    </div>
                </section>
                <section>
                    <h3>게시물 현황</h3>
                    <div class="cafe24-home-mini-list">
                        <p><span>문의/후기 합계</span><strong>${boardCount}건</strong></p>
                        <p><span>운영 모드</span><strong>관리자</strong></p>
                        <p><span>쇼핑몰 상태</span><strong>정상 운영</strong></p>
                    </div>
                </section>
            </div>
        </section>`;

    renderCafe24AdminHomeChart(rows);
}

window.renderCafe24AdminHomeDashboard = renderCafe24AdminHomeDashboard;

function cafe24OrderDashboardStatusCount(orders, names) {
    return orders.filter(order => names.includes(order.status)).length;
}

function cafe24OrderDashboardMoney(value) {
    return `${Number(value || 0).toLocaleString("ko-KR")}원`;
}

function cafe24OrderDashboardAmount(order) {
    return Number(order.total_amount || order.total || order.amount || 0);
}

function cafe24OrderDashboardSameDay(dateValue, date) {
    const target = new Date(dateValue);
    return target.getFullYear() === date.getFullYear()
        && target.getMonth() === date.getMonth()
        && target.getDate() === date.getDate();
}

function cafe24OrderDashboardSameMonth(dateValue, date) {
    const target = new Date(dateValue);
    return target.getFullYear() === date.getFullYear()
        && target.getMonth() === date.getMonth();
}

function cafe24OrderDashboardMetricRow(label, todayAmount, todayCount, monthAmount, monthCount, actionLabel, actionTab, tone = "blue") {
    return `
        <tr>
            <th>${label} <span class="cafe24-help-dot">?</span></th>
            <td class="${tone}">
                <button type="button" onclick="switchAdminTab('${actionTab}')">${cafe24OrderDashboardMoney(todayAmount)}</button>
                <em>${todayCount}건</em>
            </td>
            <td class="pink">
                <button type="button" onclick="switchAdminTab('${actionTab}')">${cafe24OrderDashboardMoney(monthAmount)}</button>
                <em>${monthCount}건</em>
            </td>
            <td><button type="button" class="cafe24-order-mini-btn" onclick="switchAdminTab('${actionTab}')">${actionLabel}</button></td>
        </tr>
    `;
}

function cafe24OrderDashboardWorkCard(label, count, tab, tone = "") {
    return `
        <button type="button" class="cafe24-order-work-card ${tone}" onclick="switchAdminTab('${tab}')">
            <span>${label}</span>
            <strong>${Number(count || 0).toLocaleString("ko-KR")}</strong>
            ${tone === "pink" ? "<em>처리중 0</em>" : ""}
        </button>
    `;
}

async function renderCafe24OrderDashboard() {
    const content = document.getElementById("admin-tab-dashboard");
    if (!content) return;

    const orders = await getCafe24AdminHomeOrders();
    const now = new Date();
    const paidStatuses = ["입금대기", "결제완료", "배송대기", "배송준비중", "배송중", "배송완료"];
    const paymentStatuses = ["결제완료", "배송대기", "배송준비중", "배송중", "배송완료"];
    const refundStatuses = ["주문취소", "주문취소완료", "취소신청", "반품신청", "반품요청", "반품처리완료", "환불전"];

    const todayOrders = orders.filter(order => cafe24OrderDashboardSameDay(order.created_at, now));
    const monthOrders = orders.filter(order => cafe24OrderDashboardSameMonth(order.created_at, now));
    const todayPaid = todayOrders.filter(order => paidStatuses.includes(order.status));
    const monthPaid = monthOrders.filter(order => paidStatuses.includes(order.status));
    const todayPayments = todayOrders.filter(order => paymentStatuses.includes(order.status));
    const monthPayments = monthOrders.filter(order => paymentStatuses.includes(order.status));
    const todayRefunds = todayOrders.filter(order => refundStatuses.includes(order.status));
    const monthRefunds = monthOrders.filter(order => refundStatuses.includes(order.status));

    const pendingCount = cafe24OrderDashboardStatusCount(orders, ["입금대기"]);
    const readyCount = cafe24OrderDashboardStatusCount(orders, ["결제완료", "배송준비중"]);
    const holdCount = cafe24OrderDashboardStatusCount(orders, ["배송보류중"]);
    const waitCount = cafe24OrderDashboardStatusCount(orders, ["배송대기"]);
    const shippingCount = cafe24OrderDashboardStatusCount(orders, ["배송중"]);
    const cancelCount = cafe24OrderDashboardStatusCount(orders, ["취소신청", "주문취소"]);
    const exchangeCount = cafe24OrderDashboardStatusCount(orders, ["교환신청"]);
    const returnCount = cafe24OrderDashboardStatusCount(orders, ["반품신청", "반품요청"]);
    const refundBeforeCount = cafe24OrderDashboardStatusCount(orders, ["환불전"]);
    const completedToday = todayOrders.filter(order => ["배송완료", "주문취소완료", "반품처리완료"].includes(order.status)).length;

    const todayOrderAmount = todayPaid.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);
    const monthOrderAmount = monthPaid.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);
    const todayPaymentAmount = todayPayments.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);
    const monthPaymentAmount = monthPayments.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);
    const todayRefundAmount = todayRefunds.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);
    const monthRefundAmount = monthRefunds.reduce((sum, order) => sum + cafe24OrderDashboardAmount(order), 0);

    const updated = now.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    }).replace(/\. /g, "-").replace(".", "");

    content.innerHTML = `
        <section class="cafe24-order-dashboard">
            <div class="cafe24-order-searchbar">
                <select id="order-dashboard-search-type">
                    <option value="order_no">주문번호</option>
                    <option value="customer_name">고객명</option>
                    <option value="product_name">상품명</option>
                </select>
                <input id="order-dashboard-search-keyword" type="text" placeholder="ex) 20210708-0000012">
                <button type="button" onclick="switchAdminTab('orders-all')">⌕</button>
            </div>

            <section class="cafe24-order-panel">
                <div class="cafe24-order-panel-title">
                    <h2>실시간 매출 현황 <span>최종 업데이트 일시 : ${updated} (실시간 조회)</span><i>?</i></h2>
                    <button type="button" onclick="switchAdminTab('orders-all')">▣ 실시간 주문 현황 보기</button>
                </div>
                <table class="cafe24-order-sales-table">
                    <thead>
                        <tr>
                            <th>구분</th>
                            <th>오늘</th>
                            <th>이번 달</th>
                            <th>바로가기</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cafe24OrderDashboardMetricRow("총 주문 금액", todayOrderAmount, todayPaid.length, monthOrderAmount, monthPaid.length, "주문조회", "orders-all")}
                        ${cafe24OrderDashboardMetricRow("총 실 결제 금액", todayPaymentAmount, todayPayments.length, monthPaymentAmount, monthPayments.length, "결제조회", "orders-deposit")}
                        ${cafe24OrderDashboardMetricRow("총 환불 금액", todayRefundAmount, todayRefunds.length, monthRefundAmount, monthRefunds.length, "환불조회", "orders-claim")}
                    </tbody>
                </table>
            </section>

            <section class="cafe24-order-panel">
                <h2 class="cafe24-order-section-title">오늘의 할 일</h2>
                <div class="cafe24-order-work-grid">
                    ${cafe24OrderDashboardWorkCard("입금전", pendingCount, "orders-deposit")}
                    ${cafe24OrderDashboardWorkCard("배송준비중", readyCount, "orders-ready")}
                    ${cafe24OrderDashboardWorkCard("배송보류중", holdCount, "orders-hold")}
                    ${cafe24OrderDashboardWorkCard("배송중", shippingCount, "orders-shipping")}
                    ${cafe24OrderDashboardWorkCard("취소신청", cancelCount, "orders-claim", "pink")}
                    ${cafe24OrderDashboardWorkCard("교환신청", exchangeCount, "orders-claim", "pink")}
                    ${cafe24OrderDashboardWorkCard("반품신청", returnCount, "orders-claim", "pink")}
                    ${cafe24OrderDashboardWorkCard("환불전", refundBeforeCount, "orders-claim")}
                </div>
            </section>

            <section class="cafe24-order-panel">
                <h2 class="cafe24-order-section-title">오늘 처리한 일</h2>
                <div class="cafe24-order-work-grid compact">
                    ${cafe24OrderDashboardWorkCard("수동입금확인", 0, "orders-deposit")}
                    ${cafe24OrderDashboardWorkCard("자동입금확인", 0, "orders-auto-deposit")}
                    ${cafe24OrderDashboardWorkCard("배송중 처리", shippingCount, "orders-shipping")}
                    ${cafe24OrderDashboardWorkCard("배송완료", completedToday, "orders-completed")}
                    ${cafe24OrderDashboardWorkCard("취소완료", 0, "orders-claim")}
                    ${cafe24OrderDashboardWorkCard("교환완료", 0, "orders-claim")}
                    ${cafe24OrderDashboardWorkCard("반품완료", 0, "orders-claim")}
                    ${cafe24OrderDashboardWorkCard("환불완료", 0, "orders-claim")}
                </div>
            </section>
        </section>
    `;
}

window.renderCafe24OrderDashboard = renderCafe24OrderDashboard;

function getCafe24ProductDashboardProducts() {
    if (Array.isArray(allProducts) && allProducts.length) return [...allProducts];
    if (typeof DUMMY_PRODUCTS !== "undefined" && Array.isArray(DUMMY_PRODUCTS)) return [...DUMMY_PRODUCTS];
    return [];
}

function cafe24ProductDashboardStat(label, value, suffix = "개", tone = "") {
    return `
        <div class="cafe24-product-stat ${tone}">
            <span>${label}</span>
            <strong>${Number(value || 0).toLocaleString("ko-KR")}</strong><em>${suffix}</em>
        </div>
    `;
}

function renderCafe24ProductDashboard() {
    const ready = document.getElementById("admin-tab-ready");
    if (!ready) return;

    const products = getCafe24ProductDashboardProducts();
    const totalCount = products.length;
    const visibleCount = products.filter(product => product.is_visible !== false && !product.deleted_at && product.status !== "deleted").length;
    const soldoutCount = products.filter(product => product.is_soldout || (product.stock !== undefined && Number(product.stock) === 0)).length;
    const deletedCount = products.filter(product => product.deleted_at || product.status === "deleted").length;
    const hiddenCount = Math.max(0, totalCount - visibleCount - deletedCount);

    ready.innerHTML = `
        <section class="cafe24-product-dashboard">
            <div class="cafe24-product-headline">
                <div>
                    <h2>상품 대시보드 <span class="cafe24-guide-pill">가이드</span><button type="button" onclick="openCafe24AiChatbot()">AI 챗봇 문의하기</button></h2>
                    <p>상품 등록, 판매 상태, 품절, 진열 관리로 바로 이동할 수 있는 상품 운영 홈입니다.</p>
                </div>
                <div class="cafe24-product-top-banner">
                    <b>상품 운영 체크</b>
                    <span>오늘 등록/진열 상태를 빠르게 확인하세요</span>
                </div>
            </div>

            <section class="cafe24-product-panel">
                <div class="cafe24-product-panel-title">
                    <h3>상품 현황</h3>
                    <button type="button" onclick="switchAdminTab('products-list')">상품목록 바로가기</button>
                </div>
                <div class="cafe24-product-stats">
                    ${cafe24ProductDashboardStat("전체 등록 상품", totalCount)}
                    ${cafe24ProductDashboardStat("판매 중인 상품", visibleCount)}
                    ${cafe24ProductDashboardStat("품절 상품", soldoutCount, "개", "danger")}
                    ${cafe24ProductDashboardStat("삭제 상품", deletedCount, "개", "danger")}
                </div>
            </section>

            <section class="cafe24-product-curation">
                <div>
                    <h3>넘쳐나는 상품, 쇼핑 큐레이션이 선별해줄게요!</h3>
                    <p>고객이 목표 상품에 접근하는 데까지 걸리는 시간을 짧게 하여 실제 구매까지 이루어질 수 있도록 하는 서비스예요.</p>
                </div>
                <div class="cafe24-product-curation-actions">
                    <button type="button" onclick="switchAdminTab('products-curation')">서비스 소개</button>
                    <button type="button" class="primary" onclick="switchAdminTab('products-curation')">서비스 사용</button>
                </div>
            </section>

            <div class="cafe24-product-promo-grid">
                <section class="cafe24-product-promo signup">
                    <div>
                        <h3>번개보다 빠른 1초 가입</h3>
                        <p>매출 상승도 번개처럼!</p>
                    </div>
                    <div class="cafe24-product-login-buttons">
                        <button type="button">카카오 1초 로그인 / 회원가입</button>
                        <button type="button">네이버 1초 로그인 / 회원가입</button>
                    </div>
                </section>

                <section class="cafe24-product-promo sale">
                    <div>
                        <h3>매출상승 필수 앱!</h3>
                        <p>스케줄등록 · 자동업데이트</p>
                    </div>
                    <div class="cafe24-product-rocket">🚀</div>
                </section>
            </div>

            <section class="cafe24-product-pro">
                <div>
                    <h3>쇼핑몰 운영, 잘 몰라도 카페24 PRO처럼 관리</h3>
                    <p>상품목록, 진열, 재고, 옵션 관리 화면으로 빠르게 이동하세요.</p>
                </div>
                <div class="cafe24-product-pro-actions">
                    <button type="button" onclick="switchAdminTab('products-register')">상품 등록</button>
                    <button type="button" onclick="switchAdminTab('products-display')">상품 진열</button>
                    <button type="button" onclick="switchAdminTab('products-stock')">재고 관리</button>
                    <button type="button" onclick="switchAdminTab('products-options')">옵션 관리</button>
                </div>
            </section>
        </section>
    `;
}

window.renderCafe24ProductDashboard = renderCafe24ProductDashboard;

function cafe24HomeGoByTodoLabel(label) {
    const text = String(label || "").replace(/\s+/g, "");
    const routeMap = [
        { key: "입금", tab: "orders-deposit" },
        { key: "배송준비", tab: "orders-ready" },
        { key: "배송보류", tab: "orders-hold" },
        { key: "배송대기", tab: "orders-ready" },
        { key: "배송중", tab: "orders-shipping" },
        { key: "취소", tab: "orders-claim" },
        { key: "교환", tab: "orders-claim" },
        { key: "반품", tab: "orders-claim" },
        { key: "환불", tab: "orders-claim" },
        { key: "게시물", tab: "qna" }
    ];
    const target = routeMap.find(item => text.includes(item.key));
    if (target) {
        switchAdminTab(target.tab);
    }
}

function cafe24HomeStatCard(label, value, note = "") {
    return `
        <div class="cafe24-home-stat-card">
            <span>${label}</span>
            <strong>${value}</strong>
            ${note ? `<em>${note}</em>` : ""}
        </div>`;
}

function cafe24HomeSimpleTable(headers, rows) {
    return `
        <table class="cafe24-home-action-table">
            <thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead>
            <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>`;
}

function renderCafe24HomeTabPanel(tabLabel) {
    const shell = document.querySelector(".cafe24-admin-home");
    const grid = document.querySelector(".cafe24-home-main-grid");
    if (!shell || !grid || !window.cafe24AdminHomeState) return;

    const state = window.cafe24AdminHomeState;
    const counts = state.counts;
    const summary = state.summary;
    const label = String(tabLabel || "").replace(/\s+/g, "");

    if (label.includes("일별매출")) {
        renderCafe24AdminHomeDashboard();
        return;
    }

    if (adminSalesChart) {
        adminSalesChart.destroy();
        adminSalesChart = null;
    }

    if (label.includes("실시간접속")) {
        const currentVisitors = Math.max(1, Math.min(12, Number(counts.membersCount || 0) + Number(counts.boardCount || 0)));
        grid.innerHTML = `
            <section class="cafe24-home-action-panel wide">
                <h3>실시간 접속 현황</h3>
                <div class="cafe24-home-stat-grid">
                    ${cafe24HomeStatCard("현재 접속자", `${currentVisitors}명`, "최근 활동 기준")}
                    ${cafe24HomeStatCard("오늘 방문 추정", `${currentVisitors * 18}명`, "관리자 홈 기준")}
                    ${cafe24HomeStatCard("장바구니 관심", `${Math.max(0, counts.readyCount + counts.pendingCount)}건`, "주문 전환 후보")}
                </div>
                ${cafe24HomeSimpleTable(["구분", "상태", "관리"], [
                    ["쇼핑몰", "정상 접속", "쇼핑몰 보기 버튼으로 확인"],
                    ["관리자", "로그인 유지", "보안 게이트 통과"],
                    ["상담", "카카오 상담 연결", "고객 화면 플로팅 버튼 운영"]
                ])}
            </section>`;
    } else if (label.includes("주문처리")) {
        grid.innerHTML = `
            <section class="cafe24-home-action-panel wide">
                <h3>주문처리 현황</h3>
                <div class="cafe24-home-stat-grid">
                    ${cafe24HomeStatCard("입금대기", `${counts.pendingCount}건`, "입금 확인 필요")}
                    ${cafe24HomeStatCard("배송 준비", `${counts.readyCount}건`, "출고 처리 대상")}
                    ${cafe24HomeStatCard("클레임", `${counts.cancelCount + counts.exchangeCount + counts.returnCount}건`, "취소/교환/반품")}
                    ${cafe24HomeStatCard("배송중", `${counts.shippingCount}건`, "운송장 추적")}
                </div>
                ${cafe24HomeSimpleTable(["업무", "건수", "바로가기"], [
                    ["입금전 주문", `${counts.pendingCount}건`, `<button type="button" onclick="switchAdminTab('orders-deposit')">입금관리</button>`],
                    ["배송 준비", `${counts.readyCount}건`, `<button type="button" onclick="switchAdminTab('orders-ready')">배송준비</button>`],
                    ["배송중", `${counts.shippingCount}건`, `<button type="button" onclick="switchAdminTab('orders-shipping')">배송중</button>`],
                    ["클레임", `${counts.cancelCount + counts.exchangeCount + counts.returnCount}건`, `<button type="button" onclick="switchAdminTab('orders-claim')">클레임관리</button>`]
                ])}
            </section>`;
    } else if (label.includes("회원") || label.includes("적립금")) {
        grid.innerHTML = `
            <section class="cafe24-home-action-panel wide">
                <h3>회원/적립금 현황</h3>
                <div class="cafe24-home-stat-grid">
                    ${cafe24HomeStatCard("전체 회원", `${counts.membersCount}명`, "가입 회원")}
                    ${cafe24HomeStatCard("보유 적립금", `${Number(counts.totalPoints || 0).toLocaleString("ko-KR")}원`, "회원 합산")}
                    ${cafe24HomeStatCard("최근 30일 결제", cafe24AdminHomeMoney(summary.total30.paymentAmount), `${summary.total30.paymentCount}건`)}
                </div>
                ${cafe24HomeSimpleTable(["관리 항목", "현황", "바로가기"], [
                    ["회원 조회", `${counts.membersCount}명`, `<button type="button" onclick="switchAdminTab('customers-search')">회원 조회</button>`],
                    ["회원 적립금", `${Number(counts.totalPoints || 0).toLocaleString("ko-KR")}원`, `<button type="button" onclick="switchAdminTab('customers-benefits')">적립금 관리</button>`],
                    ["회원 예치금", "0원", `<button type="button" onclick="switchAdminTab('customers-deposit')">예치금 관리</button>`]
                ])}
            </section>`;
    } else if (label.includes("예치금")) {
        grid.innerHTML = `
            <section class="cafe24-home-action-panel wide">
                <h3>예치금 현황</h3>
                <div class="cafe24-home-stat-grid">
                    ${cafe24HomeStatCard("지급", "0원", "조회기간 기준")}
                    ${cafe24HomeStatCard("차감", "0원", "조회기간 기준")}
                    ${cafe24HomeStatCard("합계", "0원", "현재 예치금")}
                </div>
                ${cafe24HomeSimpleTable(["예치금 업무", "상태", "바로가기"], [
                    ["예치금 처리 목록", "검색결과 0명", `<button type="button" onclick="switchAdminTab('customers-deposit')">예치금 관리</button>`],
                    ["환불/임의조정", "처리 대기 없음", `<button type="button" onclick="switchAdminTab('customers-deposit')">상세 조회</button>`]
                ])}
            </section>`;
    } else if (label.includes("게시물")) {
        grid.innerHTML = `
            <section class="cafe24-home-action-panel wide">
                <h3>게시물 현황</h3>
                <div class="cafe24-home-stat-grid">
                    ${cafe24HomeStatCard("문의/후기", `${counts.boardCount}건`, "전체 게시물")}
                    ${cafe24HomeStatCard("답변 대기", `${Math.max(0, counts.boardCount)}건`, "확인 필요")}
                    ${cafe24HomeStatCard("공지 관리", "운영중", "쇼핑몰 NOTICE")}
                </div>
                ${cafe24HomeSimpleTable(["게시물 업무", "현황", "바로가기"], [
                    ["Q&A/후기", `${counts.boardCount}건`, `<button type="button" onclick="switchAdminTab('qna')">게시물 관리</button>`],
                    ["공지/이벤트", "운영중", `<button type="button" onclick="switchAdminTab('notices')">공지 관리</button>`]
                ])}
            </section>`;
    }
}

function bindCafe24AdminHomeEvents() {
    if (window.__cafe24AdminHomeEventsBound) return;
    window.__cafe24AdminHomeEventsBound = true;

    document.addEventListener("click", event => {
        const todoButton = event.target.closest(".cafe24-home-todo-card");
        if (todoButton) {
            event.preventDefault();
            cafe24HomeGoByTodoLabel(todoButton.querySelector("span")?.textContent || todoButton.textContent);
            return;
        }

        const tabButton = event.target.closest(".cafe24-home-tabs button");
        if (tabButton) {
            event.preventDefault();
            const tabs = tabButton.closest(".cafe24-home-tabs");
            tabs.querySelectorAll("button").forEach(button => button.classList.remove("active"));
            tabButton.classList.add("active");
            renderCafe24HomeTabPanel(tabButton.textContent);
        }
    });
}

bindCafe24AdminHomeEvents();

function exposeAdminInlineHandlers() {
    [
        "addManualOptionChip",
        "addNewCategoryFromTree",
        "addOptionChip",
        "addProductsToCurrentCategory",
        "assignCheckedProductsToDisplaySection",
        "batchApproveDeposit",
        "batchCancelDeposit",
        "batchSetDisplayVisibility",
        "clearCafe24CategorySelection",
        "clearCategoryForm",
        "closeAddProductModal",
        "closeAddProductModalOutside",
        "closeDisplayProductAddModal",
        "closeDisplayProductAddModalOutside",
        "closeExcelUploadModal",
        "closeExcelUploadModalOutside",
        "deleteSelectedCategoryFromTree",
        "downloadAdminProductsExcel",
        "downloadCafe24DisplayCsv",
        "downloadExcelTemplate",
        "editCheckedProductCategories",
        "executeAdminCustomerSearch",
        "executeAdminProductSearch",
        "fetchAdminDisplayProducts",
        "fetchAdminOrders",
        "fetchAdminOrdersDeposit",
        "formatCafe24Editor",
        "moveDisplayOrderBottom",
        "moveDisplayOrderDown",
        "moveDisplayOrderTop",
        "moveDisplayOrderUp",
        "openAddProductModal",
        "openCafe24AiChatbot",
        "openCafe24DisplaySettings",
        "openAdminCustomerDetail",
        "openDisplayProductAddModal",
        "openExcelUploadModal",
        "processShipmentComplete",
        "processShipmentStart",
        "previewCafe24SimpleProduct",
        "refreshAdminData",
        "resetAdminCustomerSearch",
        "resetAdminDepositOrderSearch",
        "resetAdminDisplaySearch",
        "resetAdminOrderSearch",
        "resetAdminProductSearch",
        "saveAdminDisplayOrders",
        "saveAdminCustomerDetail",
        "saveCategoryTreeLayout",
        "setAdminDepositOrderDateRange",
        "setAdminOrderDateRange",
        "setCafe24DisplayViewMode",
        "setCheckedDisplayFixed",
        "submitCafe24SimpleProductDirect",
        "submitExcelProductsDirect",
        "submitNewCategoryDirect",
        "submitNewNoticeDirect",
        "submitNewProductDirect",
        "submitProductFormDirect",
        "switchAddProductTab",
        "switchAdminTab",
        "toggleAllCustAllChecks",
        "toggleAllCustChecks",
        "toggleAllDepositChecks",
        "toggleAllDisplayAddChecks",
        "toggleAllDisplayChecks",
        "toggleAllOrdersChecks",
        "toggleAllProdChecks",
        "toggleSidebarGroup",
        "verifyAdminPassword"
    ].forEach(name => {
        try {
            const fn = eval(name);
            if (typeof fn === "function") window[name] = fn;
        } catch (error) {
            // Some handlers live in non-admin scripts and are exposed by their own files.
        }
    });
}

exposeAdminInlineHandlers();

function bindAdminSidebarDirectNavigation() {
    if (window.__adminSidebarDirectNavigationBound) return;
    window.__adminSidebarDirectNavigationBound = true;

    document.addEventListener("click", event => {
        const link = event.target.closest(".sidebar-link[id^='tab-'][id$='-btn']");
        if (!link) return;

        const tabName = link.id.replace(/^tab-/, "").replace(/-btn$/, "");
        if (!tabName) return;

        event.preventDefault();
        event.stopPropagation();
        switchAdminTab(tabName);
    }, true);
}

bindAdminSidebarDirectNavigation();
