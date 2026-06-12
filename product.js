// 👑 [신설] 1만 개 대량 상품 수용용 페이지네이션 및 브랜드 필터 제어 전역 변수
// (※ 중복 선언 방지를 위해 해당 전역 변수들은 app.js의 선언부로 통합 이관되었습니다)

// 🏷️ [계층형 카테고리 고도화] 대/중/소 계층형 카테고리 필터 상태 변수 신설
// (※ 중복 선언 방지를 위해 해당 전역 변수들은 app.js의 선언부로 통합 이관되었습니다)

// =========================================================================
// 4. [❤️ 찜하기(Wishlist) 및 최근 본 상품 퀵 바 코어 로직 완비]
// =========================================================================
function loadWishlistFromStorage() {
    try {
        const saved = safeLocalStorage.getItem("pkb71_wish");
        if (saved) wishlist = JSON.parse(saved);
    } catch(e) {}
}

function saveWishlistToStorage() {
    safeLocalStorage.setItem("pkb71_wish", JSON.stringify(wishlist));
    const count = document.getElementById("mypage-wish-count");
    if (count) count.textContent = wishlist.length;
}

function toggleWishlist(prodId, event) {
    if (event) event.stopPropagation();
    
    const index = wishlist.indexOf(prodId);
    if (index !== -1) {
        wishlist.splice(index, 1);
        alert("♥ 찜 목록에서 제외되었습니다.");
    } else {
        wishlist.push(prodId);
        alert("❤️ 관심 상품 찜 목록에 보관 완료되었습니다! 마이페이지에서 모아 보실 수 있습니다.");
    }
    
    saveWishlistToStorage();
    executeFilterAndSort();
}

function toggleWishlistDetail() {
    if (!currentProduct) return;
    
    const btn = document.getElementById("det-wish-btn");
    const prodId = currentProduct.id;
    const index = wishlist.indexOf(prodId);
    
    if (index !== -1) {
        wishlist.splice(index, 1);
        if (btn) {
            btn.classList.remove("active");
            btn.textContent = "♡";
        }
        alert("♥ 찜 목록에서 제외되었습니다.");
    } else {
        wishlist.push(prodId);
        if (btn) {
            btn.classList.add("active");
            btn.textContent = "♥";
        }
        alert("❤️ 관심 상품 찜 목록에 보관 완료되었습니다!");
    }
    saveWishlistToStorage();
}

function loadRecentViewedFromStorage() {
    try {
        const saved = safeLocalStorage.getItem("pkb71_recent");
        if (saved) recentViewed = JSON.parse(saved);
    } catch(e) {}
}

function trackRecentViewed(prodId) {
    const index = recentViewed.indexOf(prodId);
    if (index !== -1) {
        recentViewed.splice(index, 1);
    }
    recentViewed.unshift(prodId);
    
    if (recentViewed.length > 3) recentViewed.pop();
    
    safeLocalStorage.setItem("pkb71_recent", JSON.stringify(recentViewed));
    renderRecentQuickBar();
}

function renderRecentQuickBar() {
    const list = document.getElementById("quick-recent-list");
    if (!list) return;
    list.innerHTML = "";
    
    if (recentViewed.length === 0) {
        list.innerHTML = `<p class="quick-empty-text">비어있음</p>`;
        return;
    }
    
    recentViewed.forEach(id => {
        const prod = allProducts.find(p => p.id === id);
        if (prod) {
            const card = document.createElement("div");
            card.className = "quick-item-card";
            card.onclick = () => showProductDetail(prod.id);
            
            const repImg = (prod.image_urls && prod.image_urls.length > 0) ? prod.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=100";
            
            card.innerHTML = `<img src="${repImg}" title="${prod.name}">`;
            list.appendChild(card);
        }
    });
}

function renderMyPageWishlist() {
    const container = document.getElementById("mypage-wish-container");
    if (!container) return;
    container.innerHTML = "";
    
    if (wishlist.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); width: 100%; font-size:12px; padding: 20px 0;">보관된 관심 상품이 존재하지 않습니다.</p>`;
        return;
    }
    
    wishlist.forEach(id => {
        const prod = allProducts.find(p => p.id === id);
        if (prod) {
            const card = document.createElement("div");
            card.className = "mypage-wish-card";
            card.onclick = () => showProductDetail(prod.id);
            
            const repImg = (prod.image_urls && prod.image_urls.length > 0) ? prod.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=200";
            
            card.innerHTML = `
                <img src="${repImg}">
                <span class="mypage-wish-name">${prod.name}</span>
            `;
            container.appendChild(card);
        }
    });
}

function showProductDetail(id) {
    const prod = allProducts.find(p => p.id === id);
    if (!prod) return;
    
    currentProduct = prod;
    selectedColor = "";
    selectedSize = "";
    
    trackRecentViewed(prod.id);
    
    document.getElementById("hero-banner").style.display = "none";
    
    // 1. 임시 스켈레톤 UI 우선 노출 (150ms간 유지하여 자연스러운 디졸브 연출)
    const mainImgContainer = document.getElementById("detail-main-img-container");
    const subImagesContainer = document.getElementById("detail-sub-images-container");
    
    if (mainImgContainer) {
        mainImgContainer.innerHTML = `<div class="skeleton-block skeleton-img-box"></div>`;
    }
    if (subImagesContainer) {
        subImagesContainer.innerHTML = "";
    }
    
    // 텍스트 영역 스켈레톤 노출
    const brandEl = document.getElementById("det-brand");
    const nameEl = document.getElementById("det-name");
    const descEl = document.getElementById("det-description");
    
    if (brandEl) brandEl.innerHTML = `<div class="skeleton-block" style="width: 100px; height: 16px;"></div>`;
    if (nameEl) nameEl.innerHTML = `<div class="skeleton-block" style="width: 250px; height: 26px; margin: 5px 0;"></div>`;
    if (descEl) descEl.innerHTML = `
        <div class="skeleton-block" style="width: 100%; height: 14px; margin-bottom: 8px;"></div>
        <div class="skeleton-block" style="width: 90%; height: 14px; margin-bottom: 8px;"></div>
        <div class="skeleton-block" style="width: 75%; height: 14px;"></div>
    `;
    
    // 화면 활성화
    navigateTo('detail');
    
    // 2. 150ms 비동기 지연 후 실제 로드
    setTimeout(() => {
        if (brandEl) brandEl.textContent = prod.brand;
        if (nameEl) nameEl.textContent = prod.name;
        
        // 소비자가 계산 (원가 대비 약 1.35배 적용하여 1000원 단위 올림 처리)
        const calculatedOriginal = Math.ceil((prod.selling_price * 1.35) / 1000) * 1000;
        const calculatedRate = Math.round(((calculatedOriginal - prod.selling_price) / calculatedOriginal) * 100);
        
        const priceOriginalEl = document.getElementById("det-price-original");
        const discountRateEl = document.getElementById("det-discount-rate");
        const priceEl = document.getElementById("det-price");
        
        if (priceOriginalEl) priceOriginalEl.textContent = calculatedOriginal.toLocaleString();
        if (discountRateEl) discountRateEl.textContent = `${calculatedRate}% OFF`;
        if (priceEl) priceEl.textContent = prod.selling_price.toLocaleString();
        
        let cleanDetails = prod.details || "";
        // 꼬리표 정제 (카테고리 및 옵션설정 메타데이터 제거)
        cleanDetails = cleanDetails.replace(/\[카테고리:[^\]]+\]\s*/g, "");
        cleanDetails = cleanDetails.replace(/\[옵션설정:[^\]]+\]\s*/g, "");
        
        if (descEl) descEl.textContent = cleanDetails;
        
        const materialTd = document.getElementById("det-material");
        if (materialTd) {
            const matMatch = cleanDetails.match(/소재\s*:\s*([^?\n]+)/) || cleanDetails.match(/혼용률\s*:\s*([^?\n]+)/);
            materialTd.textContent = matMatch ? matMatch[1].trim() : "상세 참조";
        }
        
        if (mainImgContainer) mainImgContainer.innerHTML = "";
        if (subImagesContainer) subImagesContainer.innerHTML = "";
        
        if (prod.image_urls && prod.image_urls.length > 0) {
            // 1. 첫 번째 이미지 대표 노출
            if (mainImgContainer) {
                const mainImg = document.createElement("img");
                mainImg.src = prod.image_urls[0];
                mainImg.alt = "Representative Main View";
                mainImg.onerror = function() {
                    this.onerror = null;
                    this.src = "https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600";
                };
                mainImgContainer.appendChild(mainImg);
            }
            
            // 2. 두 번째 이미지부터 서브 이미지 나열
            if (subImagesContainer) {
                const subUrls = prod.image_urls.slice(1);
                if (subUrls.length > 0) {
                    subUrls.forEach(url => {
                        const img = document.createElement("img");
                        img.src = url;
                        img.className = "detail-sub-img";
                        img.onerror = function() {
                            this.style.display = "none";
                        };
                        subImagesContainer.appendChild(img);
                    });
                }
            }
        } else {
            // 이미지 없을 때 대응
            if (mainImgContainer) {
                mainImgContainer.innerHTML = `<img src="https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800" alt="No Image">`;
            }
        }
    }, 150);
    
    // 🌟 [아울렛몰.shop 스타일] 드롭다운 옵션 동적 주입 렌더링
    const colorSelect = document.getElementById("det-colors-select");
    const sizeSelect = document.getElementById("det-sizes-select");
    
    if (colorSelect && sizeSelect) {
        colorSelect.innerHTML = `<option value="">- [필수] 색상 옵션을 선택해 주세요 -</option>`;
        sizeSelect.innerHTML = `<option value="">- [필수] 사이즈 옵션을 선택해 주세요 -</option>`;
        
        const colors = prod.colors || [];
        const sizes = prod.sizes || [];
        
        if (colors.length === 0) {
            const opt = document.createElement("option");
            opt.value = "단독색상";
            opt.textContent = "단독색상";
            colorSelect.appendChild(opt);
        } else {
            colors.forEach(c => {
                const opt = document.createElement("option");
                opt.value = c;
                opt.textContent = c;
                colorSelect.appendChild(opt);
            });
        }
        
        if (sizes.length === 0) {
            const opt = document.createElement("option");
            opt.value = "Free";
            opt.textContent = "Free";
            sizeSelect.appendChild(opt);
        } else {
            sizes.forEach(s => {
                const opt = document.createElement("option");
                opt.value = s;
                opt.textContent = s;
                sizeSelect.appendChild(opt);
            });
        }
    }
    
    // 다중 선택 상태 및 컨테이너 초기화
    selectedOptions = [];
    renderSelectedOptions();
    updateTotalPrice();
    
    const wishBtn = document.getElementById("det-wish-btn");
    if (wishBtn) {
        if (wishlist.includes(prod.id)) {
            wishBtn.classList.add("active");
            wishBtn.innerHTML = "♥ WISH LIST";
        } else {
            wishBtn.classList.remove("active");
            wishBtn.innerHTML = "♡ WISH LIST";
        }
    }
    
    const cartBtn = document.getElementById("add-to-cart-btn");
    const buyBtn = document.getElementById("buy-now-btn");
    
    // [재고/품절 고도화] 노출 중단 또는 품절 설정 또는 재고 소진 시 구매 불가 처리
    const isProductSoldOut = !prod.is_visible || prod.is_soldout || (prod.stock !== undefined && prod.stock <= 0);
    
    if (isProductSoldOut) {
        if (cartBtn) {
            cartBtn.textContent = "품절 완료";
            cartBtn.disabled = true;
            cartBtn.style.cursor = "not-allowed";
        }
        if (buyBtn) {
            buyBtn.textContent = "품절 완료 (SOLD OUT)";
            buyBtn.disabled = true;
            buyBtn.style.backgroundColor = "var(--text-secondary)";
            buyBtn.style.borderColor = "var(--text-secondary)";
            buyBtn.style.cursor = "not-allowed";
        }
    } else {
        if (cartBtn) {
            cartBtn.textContent = "🛒 ADD CART (장바구니)";
            cartBtn.disabled = false;
            cartBtn.style.cursor = "pointer";
        }
        if (buyBtn) {
            buyBtn.textContent = "⚡ BUY IT NOW (바로 구매하기)";
            buyBtn.disabled = false;
            buyBtn.style.backgroundColor = "var(--text-primary)";
            buyBtn.style.borderColor = "var(--text-primary)";
            buyBtn.style.cursor = "pointer";
        }
    }

    // 📂 [Fail-safe 방어막] 아코디언 탭이 존재하는 경우에만 부드럽게 초기화
    const accordionItems = document.querySelectorAll(".luxury-accordion .accordion-item");
    if (accordionItems && accordionItems.length > 0) {
        accordionItems.forEach((item, index) => {
            if (index === 0) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });
    }

    fetchReviews(prod.id);
    
    // 📂 [3안] 아코디언 가이드라인 닫힘 상태로 초기화 (새 상품 진입 시 자동으로 얌전히 닫아두기)
    const guidAccordion = document.querySelector(".luxury-guidelines-accordion");
    const guidContent = document.getElementById("guidelines-accordion-content");
    const guidIcon = document.getElementById("guidelines-accordion-icon");
    if (guidAccordion && guidContent) {
        guidAccordion.classList.remove("active");
        guidContent.style.maxHeight = "0";
        guidContent.style.padding = "0 40px";
        if (guidIcon) guidIcon.textContent = "▼";
    }

    // 📄 [신설] 아코디언 상품 상세 설명 닫힘 상태로 초기화 (동일하게 기본 닫힘 세팅)
    const descAccordion = document.querySelector(".luxury-description-accordion");
    const descContent = document.getElementById("description-accordion-content");
    const descIcon = document.getElementById("description-accordion-icon");
    if (descAccordion && descContent) {
        descAccordion.classList.remove("active");
        descContent.style.maxHeight = "0";
        descContent.style.padding = "0 40px";
        if (descIcon) descIcon.textContent = "▼";
    }

    navigateTo('detail');
}

// 📂 [신설 5차 고도화] Quiet Luxury 극미니멀 아코디언 토글 인터랙션 엔진 (대표님 교육용 한글 주석 완비)
function toggleAccordion(buttonElement) {
    // 클릭한 버튼의 부모 요소인 .accordion-item을 찾습니다.
    const currentItem = buttonElement.parentElement;
    // 아코디언 전체 감싸는 .luxury-accordion 요소를 찾습니다.
    const accordion = currentItem.parentElement;
    
    // 현재 클릭한 아이템을 제외한 나머지 모든 아코디언 아이템들의 active 클래스를 제거하여 닫아줍니다. (단일 펼침 보장)
    const allItems = accordion.querySelectorAll('.accordion-item');
    allItems.forEach(item => {
        if (item !== currentItem) {
            item.classList.remove('active');
        }
    });
    
    // 현재 클릭한 아이템의 active 클래스를 토글(추가/제거)하여 열거나 닫아줍니다.
    currentItem.classList.toggle('active');
}

// 🌟 [신설 - 아울렛몰.shop 정통 스타일] 상세페이지 전용 다중 옵션 품목 동적 제어 컴포넌트

/**
 * 1. 드롭다운 선택 시 트리거되는 옵션 체인지 핸들러
 * - 색상과 사이즈를 선택하면 조합이 완성되어 selectedOptions 배열에 상품을 밀어 넣습니다.
 */
function handleOptionChange() {
    if (!currentProduct) return;
    
    const colorSelect = document.getElementById("det-colors-select");
    const sizeSelect = document.getElementById("det-sizes-select");
    
    if (!colorSelect || !sizeSelect) return;
    
    const colorVal = colorSelect.value;
    const sizeVal = sizeSelect.value;
    
    // 색상과 사이즈가 둘 다 올바르게 선택되었을 때만 품목 카드를 생성합니다.
    if (colorVal && sizeVal) {
        const optionComboId = `${colorVal}_${sizeVal}`;
        
        // 1. details 에서 [옵션설정:...] 꼬리표 파싱
        let optionSettings = {};
        const detailsText = currentProduct.details || "";
        const optMatch = detailsText.match(/\[옵션설정:([^\]]+)\]/);
        if (optMatch) {
            try {
                optionSettings = JSON.parse(optMatch[1]);
            } catch (e) {
                console.error("옵션설정 파싱 에러:", e);
            }
        }
        
        // 2. 선택한 조합에 대한 세부 설정 판독
        const itemSettings = optionSettings[optionComboId] || { is_soldout: false, stock: 99, price: 0 };
        
        // 품절 처리 체크
        if (itemSettings.is_soldout) {
            alert(`⚠️ 죄송합니다! 선택하신 [${colorVal} / ${sizeVal}] 옵션 조합은 현재 품절(SOLD OUT) 상태입니다. 🧥`);
            colorSelect.value = "";
            sizeSelect.value = "";
            return;
        }
        
        // 3. 이미 해당 옵션 조합이 목록에 등록되어 있는지 중복 여부를 먼저 검증합니다.
        const duplicateIndex = selectedOptions.findIndex(opt => opt.comboId === optionComboId);
        
        if (duplicateIndex !== -1) {
            alert("⚠️ 이미 선택 목록에 등록되어 있는 품목 옵션 조합입니다!\n아래 카드에서 수량을 직접 늘려주세요.");
            colorSelect.value = "";
            sizeSelect.value = "";
            return;
        }
        
        // 4. 개별 가격 설정 (기본 판매가 + 옵션 추가금)
        const finalItemPrice = currentProduct.selling_price + (itemSettings.price || 0);
        
        // 새로운 옵션 객체 구성 (수량 기본값: 1개)
        selectedOptions.push({
            comboId: optionComboId,
            color: colorVal,
            size: sizeVal,
            qty: 1,
            price: finalItemPrice
        });
        
        // 다음 선택을 위해 드롭다운을 정중하게 리셋합니다.
        colorSelect.value = "";
        sizeSelect.value = "";
        
        // 리스트 다시 그리기 및 총액 실시간 정밀 연산
        renderSelectedOptions();
        updateTotalPrice();
    }
}

/**
 * 2. 선택된 옵션 품목들을 화면에 예쁜 카드로 렌더링해 주는 함수
 * - [- 수량 +] 컨트롤러와 개별 품목 금액, ✕ 단추가 탑재된 유연한 카드 리스트를 동적 조립합니다.
 */
function renderSelectedOptions() {
    const container = document.getElementById("det-selected-options-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (selectedOptions.length === 0) {
        return; // 아무것도 선택 안 했으면 아예 렌더링하지 않고 종료
    }
    
    selectedOptions.forEach((opt, idx) => {
        const itemPrice = opt.price * opt.qty;
        const div = document.createElement("div");
        div.className = "selected-option-item";
        
        div.innerHTML = `
            <span class="selected-option-name">
                ${opt.color} / ${opt.size}
            </span>
            <div class="qty-controller">
                <button class="qty-btn" onclick="changeOptionQty(${idx}, -1)">-</button>
                <input type="text" class="qty-input" value="${opt.qty}" readonly>
                <button class="qty-btn" onclick="changeOptionQty(${idx}, 1)">+</button>
            </div>
            <span class="selected-option-price">
                ₩${itemPrice.toLocaleString()}
            </span>
            <button class="selected-option-remove" onclick="removeSelectedOption(${idx})">
                ✕
            </button>
        `;
        container.appendChild(div);
    });
}

/**
 * 3. 개별 추가된 품목 카드의 수량을 늘리거나 줄이는 연산 엔진
 */
function changeOptionQty(index, delta) {
    if (index < 0 || index >= selectedOptions.length) return;
    
    selectedOptions[index].qty += delta;
    
    // 수량이 0이하로 떨어지는 경우를 안전하게 사전 방어합니다.
    if (selectedOptions[index].qty <= 0) {
        selectedOptions[index].qty = 1;
    }
    
    renderSelectedOptions();
    updateTotalPrice();
}

/**
 * 4. 선택 품목 목록에서 특정 옵션 카드를 휴지통으로 버리는 삭제 함수
 */
function removeSelectedOption(index) {
    if (index < 0 || index >= selectedOptions.length) return;
    
    selectedOptions.splice(index, 1);
    
    renderSelectedOptions();
    updateTotalPrice();
}

/**
 * 5. 추가된 품목 카드의 전체 수량과 최종 총액을 계산해 주는 실시간 합산 엔진
 */
function updateTotalPrice() {
    const priceBox = document.getElementById("det-total-price-box");
    const totalValSpan = document.getElementById("det-total-price-val");
    const totalQtySpan = document.getElementById("det-total-qty-val");
    
    if (!priceBox || !totalValSpan || !totalQtySpan) return;
    
    if (selectedOptions.length === 0) {
        priceBox.style.display = "none";
        return;
    }
    
    // 배열 전체를 루프하며 총 수량과 총 가격을 정밀 누적 연산
    let totalQty = 0;
    let totalPrice = 0;
    
    selectedOptions.forEach(opt => {
        totalQty += opt.qty;
        totalPrice += (opt.price * opt.qty);
    });
    
    // 화면에 리얼타임 이식
    totalValSpan.textContent = `₩${totalPrice.toLocaleString()}`;
    totalQtySpan.textContent = `(${totalQty}개)`;
    
    // 계산대 화면을 부드럽게 노출시킵니다.
    priceBox.style.display = "flex";
}

/**
 * 6. 👑 [아울렛몰.shop 바로구매 덤프 기동] buyItNowDirect 함수
 * - 선택한 모든 다중 품목을 장바구니에 강제 덤프 동기화하고, 모달 창 생략 후 결제 대장(`view-checkout`)으로 다이렉트 고속 점프합니다.
 */
function buyItNowDirect() {
    if (!currentProduct) return;
    
    if (selectedOptions.length === 0) {
        alert("원하시는 의류의 [색상]과 [사이즈] 옵션을 먼저 선택하여 아래에 품목 카드를 추가해 주세요! 🧥✨");
        return;
    }
    
    // 선택된 모든 조합을 장바구니(cart)에 덤프 적재합니다.
    selectedOptions.forEach(opt => {
        const cartItemId = `${currentProduct.id}_${opt.color}_${opt.size}`;
        const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);
        
        if (existingIndex !== -1) {
            cart[existingIndex].qty += opt.qty;
        } else {
            const repImg = (currentProduct.image_urls && currentProduct.image_urls.length > 0) 
                ? currentProduct.image_urls[0] 
                : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
                
            cart.push({
                cartItemId: cartItemId,
                prodId: currentProduct.id,
                brand: currentProduct.brand,
                name: currentProduct.name,
                color: opt.color,
                size: opt.size,
                price: opt.price, // ⚡ 옵션 추가금이 가산된 실제 품목 가격 적용
                thumb: repImg,
                qty: opt.qty
            });
        }
    });
    
    saveCartToStorage();
    // ⚡ 모달 팝업을 거치지 않고 바로 웅장한 무통장 입금 주문서 페이지로 초고속 점프합니다!
    goToCheckout();
}

/**
 * 7. 🛒 [장바구니 담기 개편] addProductToCart
 * - 선택된 selectedOptions 명단을 장바구니에 일괄 덤프하고 장바구니 슬라이드 모달을 부드럽게 노출시킵니다.
 */
function addProductToCart() {
    if (!currentProduct) return;
    
    if (selectedOptions.length === 0) {
        alert("원하시는 의류의 [색상]과 [사이즈] 옵션을 먼저 선택하여 아래에 품목 카드를 추가해 주세요! 🧥✨");
        return;
    }
    
    // selectedOptions를 순회하며 장바구니에 차곡차곡 채워 넣습니다.
    selectedOptions.forEach(opt => {
        const cartItemId = `${currentProduct.id}_${opt.color}_${opt.size}`;
        const existingIndex = cart.findIndex(item => item.cartItemId === cartItemId);
        
        if (existingIndex !== -1) {
            cart[existingIndex].qty += opt.qty;
        } else {
            const repImg = (currentProduct.image_urls && currentProduct.image_urls.length > 0) 
                ? currentProduct.image_urls[0] 
                : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
                
            cart.push({
                cartItemId: cartItemId,
                prodId: currentProduct.id,
                brand: currentProduct.brand,
                name: currentProduct.name,
                color: opt.color,
                size: opt.size,
                price: opt.price, // ⚡ 옵션 추가금이 가산된 실제 품목 가격 적용
                thumb: repImg,
                qty: opt.qty
            });
        }
    });
    
    saveCartToStorage();
    renderCartModalItems();
    
    // 장바구니 모달창을 품위 있게 띄워 줍니다.
    document.getElementById("cart-modal").style.display = "flex";
}

// =========================================================================
// 🔍 [다차원 검색, 카테고리 탭 정렬, 명품 칩 선택 핵심 함수군]
// =========================================================================

// 상세 페이지 내 옵션(색상/사이즈)을 고급 칩 스타일로 구조 렌더링
function renderOptionChips(options, containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    if (!options || options.length === 0) {
        container.innerHTML = `<span class="admin-opt-badge" style="background:#f1f0ee; color:#706b63;">단독 구성</span>`;
        if (type === "color") selectedColor = "단독색상";
        if (type === "size") selectedSize = "Free";
        return;
    }
    
    options.forEach(opt => {
        const chip = document.createElement("button");
        chip.className = "opt-chip";
        chip.textContent = opt;
        chip.onclick = () => selectOption(type, opt, chip);
        container.appendChild(chip);
    });
}

// 명품 고유 옵션 칩 선택 시 테두리 액티브 스타일 씌우기
function selectOption(type, value, chipElement) {
    const parent = chipElement.parentElement;
    const siblings = parent.querySelectorAll(".opt-chip");
    siblings.forEach(s => s.classList.remove("active"));
    
    chipElement.classList.add("active");
    
    if (type === "color") {
        selectedColor = value;
    } else if (type === "size") {
        selectedSize = value;
    }
}

// 👑 [신설 2단계 고도화] 등록된 전체 상품 정보에서 브랜드를 고유하게 추출하여 드롭다운에 채워주는 함수 (중복 제거 및 실시간 개수 카운팅 정렬)
function renderBrandOptions() {
    const select = document.getElementById("brand-select");
    if (!select) return;
    
    // 기본 선택을 남겨두고 초기화 (1단계 index.html 변경과 정합성을 맞춤)
    select.innerHTML = `<option value="">ALL (전체)</option>`;
    
    // 1. 브랜드별 노출 가능한 실질 상품 개수 카운팅
    const brandCounts = {};
    allProducts.forEach(p => {
        if (p.brand && p.is_visible !== false) {
            brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
        }
    });
    
    // 2. allProducts에서 brand 필드가 있는 값만 고유하게 추출
    const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))];
    
    // 3. 가나다 및 알파벳 순 정렬
    brands.sort((a, b) => a.localeCompare(b, 'ko'));
    
    // 4. 드롭다운 옵션 태그 동적 삽입
    brands.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = `${b} (${brandCounts[b] || 0}개)`;
        select.appendChild(opt);
    });
}

// 👑 [신설] 브랜드 필터 선택 핸들러
function executeBrandFilter() {
    const select = document.getElementById("brand-select");
    if (select) {
        selectedBrand = select.value;
        currentPage = 1; // 브랜드 필터 변경 시 무조건 첫 페이지로 강제 초기화
        executeFilterAndSort();
    }
}

// 검색어, 카테고리, 정렬 방식을 종합하여 전시 리스트 재구성
function executeFilterAndSort() {
    let filtered = [...allProducts];
    
    // 1. 검색어 교차 매칭
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.brand.toLowerCase().includes(query) ||
            p.details.toLowerCase().includes(query)
        );
    }
    
    // 2. 카테고리 계층형 매칭
    // 기존 currentCategory 전역 변수를 대분류 선택 값과 강제 동기화하여 타 모듈 호환성을 보장합니다.
    currentCategory = currentCategoryLarge;
    
    if (currentCategoryLarge !== "All") {
        filtered = filtered.filter(p => {
            // details 본문에서 [카테고리:대분류>중분류>소분류] 형태의 3단계 꼬리표를 파싱합니다.
            const tagMatch = p.details.match(/\[카테고리:([^\]]+)\]/);
            if (tagMatch) {
                const path = tagMatch[1];
                const parts = path.split(">").map(x => x.trim());
                
                // 3단계 구조로 파싱에 성공한 경우
                if (parts.length > 1) {
                    // 대분류 불일치 시 탈락
                    if (parts[0] !== currentCategoryLarge) return false;
                    
                    // 중분류 선택 시 불일치하면 탈락
                    if (currentCategoryMedium && parts[1] !== currentCategoryMedium) return false;
                    
                    // 소분류 선택 시 불일치하면 탈락
                    if (currentCategorySmall && parts[2] !== currentCategorySmall) return false;
                    
                    return true;
                } else {
                    // 1단 카테고리 꼬리표인 경우 (예: [카테고리:셔츠])
                    const singleCatName = parts[0];
                    
                    // 현재 선택된 필터 중 가장 세밀한 것부터 단일 카테고리명과 일치하는지 검사
                    if (currentCategorySmall) {
                        return singleCatName === currentCategorySmall;
                    }
                    if (currentCategoryMedium) {
                        return singleCatName === currentCategoryMedium;
                    }
                    if (currentCategoryLarge === singleCatName) return true;
                    
                    // 대분류만 선택된 경우: 이 대분류 하위의 모든 자식 카테고리 명칭 중 하나가 1단 카테고리와 일치하는지 확인
                    const activeLarge = localCategories.find(c => c.name === currentCategoryLarge);
                    if (activeLarge) {
                        const childCats = localCategories.filter(c => c.parent_id === activeLarge.id || 
                            localCategories.filter(m => m.parent_id === activeLarge.id).map(m => m.id).includes(c.parent_id));
                        if (childCats.some(c => c.name === singleCatName)) return true;
                    }
                    return false;
                }
            } else {
                // 꼬리표가 아예 전혀 없는 경우: 상품 정보의 텍스트 includes 매칭으로 Fail-safe 복구
                const targetFilterName = currentCategorySmall || currentCategoryMedium || currentCategoryLarge;
                return p.name.includes(targetFilterName) || 
                       p.brand.includes(targetFilterName) || 
                       p.details.includes(targetFilterName);
            }
        });
    }
    
    // 👑 2-2. [신설] 브랜드 필터 교차 매칭
    if (selectedBrand) {
        filtered = filtered.filter(p => p.brand === selectedBrand);
    }
    
    // 3. 정렬 프로세스 집행
    if (currentSort === "price-asc") {
        filtered.sort((a, b) => a.selling_price - b.selling_price);
    } else if (currentSort === "price-desc") {
        filtered.sort((a, b) => b.selling_price - a.selling_price);
    } else if (currentSort === "brand") {
        filtered.sort((a, b) => a.brand.localeCompare(b.brand, 'ko'));
    } else {
        // 🌳 [기본 정렬] display_order 오름차순(1, 2, 3...) 정렬 후, 동일 순위 시 최신 등록일 내림차순 정렬
        filtered.sort((a, b) => {
            const orderA = (a.display_order !== undefined && a.display_order !== null) ? Number(a.display_order) : 9999;
            const orderB = (b.display_order !== undefined && b.display_order !== null) ? Number(b.display_order) : 9999;
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
    }
    
    renderProductCards(filtered);
}

// 검색 버튼 클릭 시 검색 프로세스 기동
function executeSearch() {
    const input = document.getElementById("search-input");
    if (input) {
        searchQuery = input.value.trim();
        currentPage = 1; // 검색 수행 시 첫 페이지로 초기화
        executeFilterAndSort();
    }
}

// 검색어 입력 칸 엔터 키 타건 대응
function handleSearchKeyUp(event) {
    if (event.key === "Enter") {
        executeSearch();
    }
}

// 🏷️ [계층형 카테고리 고도화] 대/중/소 단계별 필터링 전용 핸들러 신설
function selectLargeCategory(catName) {
    currentCategoryLarge = catName;
    currentCategoryMedium = "";
    currentCategorySmall = "";
    currentPage = 1; // 카테고리 변경 시 첫 페이지로 초기화
    
    // 탭 UI 재렌더링
    renderShopCategoryTabs();
    
    // 🔄 [상세페이지 대응] 카테고리 탭 클릭 시, 현재 화면이 홈(컬렉션)이 아니라면 홈 화면으로 안전하게 라우팅 복귀시킵니다.
    const homeView = document.getElementById("view-home");
    if (homeView && homeView.style.display === "none") {
        navigateTo('home');
    } else {
        executeFilterAndSort();
    }
}

function selectMediumCategory(catName) {
    currentCategoryMedium = catName;
    currentCategorySmall = "";
    currentPage = 1;
    
    renderShopCategoryTabs();
    executeFilterAndSort();
}

function selectSmallCategory(catName) {
    currentCategorySmall = catName;
    currentPage = 1;
    
    renderShopCategoryTabs();
    executeFilterAndSort();
}

// 구버전 단일 카테고리 필터 호출과의 호환성을 위한 래퍼 함수
function filterByCategory(cat) {
    selectLargeCategory(cat);
}

/**
 * 👑 [계층형 카테고리 고도화] 고객 쇼핑몰 메인 화면 다이내믹 2단 서브 필터바 동적 렌더링 함수
 * - 대분류 클릭 시 연관 중분류가, 중분류 클릭 시 소분류 탭이 순차적으로 노출되는 인터랙티브 UI를 렌더링합니다.
 */
function renderShopCategoryTabs() {
    const container = document.getElementById("category-tabs-container");
    const subContainer = document.getElementById("subcategory-tabs-container");
    const microContainer = document.getElementById("microcategory-tabs-container");
    
    if (!container) return;
    
    // 1. 대분류 탭 렌더링
    container.innerHTML = "";
    
    // ALL 전체보기 탭 생성
    const allTab = document.createElement("button");
    allTab.className = `cat-tab ${currentCategoryLarge === 'All' ? 'active' : ''}`;
    allTab.textContent = "ALL";
    allTab.onclick = () => selectLargeCategory("All");
    container.appendChild(allTab);
    
    // 대분류(depth=0) 목록 로딩
    const largeCategories = localCategories.filter(c => c.depth === 0 || !c.depth);
    
    largeCategories.forEach(cat => {
        const btn = document.createElement("button");
        btn.className = `cat-tab ${currentCategoryLarge === cat.name ? 'active' : ''}`;
        btn.textContent = cat.eng_name ? cat.eng_name.toUpperCase() : cat.name;
        btn.onclick = () => selectLargeCategory(cat.name);
        container.appendChild(btn);
    });
    
    // 2. 중분류 탭 렌더링 (대분류 산하 자식들)
    if (subContainer) {
        subContainer.innerHTML = "";
        
        const activeLarge = largeCategories.find(c => c.name === currentCategoryLarge);
        
        if (currentCategoryLarge !== "All" && activeLarge) {
            const mediumCategories = localCategories.filter(c => c.depth === 1 && c.parent_id === activeLarge.id);
            
            if (mediumCategories.length > 0) {
                subContainer.style.display = "flex";
                
                // 중분류 전체보기 탭
                const allSubTab = document.createElement("button");
                allSubTab.className = `sub-cat-tab ${!currentCategoryMedium ? 'active' : ''}`;
                allSubTab.textContent = "전체";
                allSubTab.onclick = () => selectMediumCategory("");
                subContainer.appendChild(allSubTab);
                
                mediumCategories.forEach(cat => {
                    const btn = document.createElement("button");
                    btn.className = `sub-cat-tab ${currentCategoryMedium === cat.name ? 'active' : ''}`;
                    btn.textContent = cat.name;
                    btn.onclick = () => selectMediumCategory(cat.name);
                    subContainer.appendChild(btn);
                });
            } else {
                subContainer.style.display = "none";
            }
        } else {
            subContainer.style.display = "none";
        }
    }
    
    // 3. 소분류 탭 렌더링 (중분류 산하 자식들)
    if (microContainer) {
        microContainer.innerHTML = "";
        
        const activeLarge = largeCategories.find(c => c.name === currentCategoryLarge);
        const mediumCategories = activeLarge ? localCategories.filter(c => c.depth === 1 && c.parent_id === activeLarge.id) : [];
        const activeMedium = mediumCategories.find(c => c.name === currentCategoryMedium);
        
        if (currentCategoryLarge !== "All" && currentCategoryMedium && activeMedium) {
            const smallCategories = localCategories.filter(c => c.depth === 2 && c.parent_id === activeMedium.id);
            
            if (smallCategories.length > 0) {
                microContainer.style.display = "flex";
                
                // 소분류 전체보기 탭
                const allMicroTab = document.createElement("button");
                allMicroTab.className = `micro-cat-tab ${!currentCategorySmall ? 'active' : ''}`;
                allMicroTab.textContent = "전체";
                allMicroTab.onclick = () => selectSmallCategory("");
                microContainer.appendChild(allMicroTab);
                
                smallCategories.forEach(cat => {
                    const btn = document.createElement("button");
                    btn.className = `micro-cat-tab ${currentCategorySmall === cat.name ? 'active' : ''}`;
                    btn.textContent = cat.name;
                    btn.onclick = () => selectSmallCategory(cat.name);
                    microContainer.appendChild(btn);
                });
            } else {
                microContainer.style.display = "none";
            }
        } else {
            microContainer.style.display = "none";
        }
    }
}

// 정렬 셀렉트 박스 갱신 시 자동 전시 정렬 순서 기동
function executeSort() {
    const select = document.getElementById("sort-select");
    if (select) {
        currentSort = select.value;
        currentPage = 1; // 정렬 순서 변경 시 첫 페이지로 초기화
        executeFilterAndSort();
    }
}

// 상품 진열 그리드에 명품 카드들을 세련되게 채우고 품절 오버레이 장착
// 대표님의 기획 요청에 따라 신상 가로 슬라이더와 주간 베스트 랭킹 4선으로 삼등분 분할 인출 렌더링을 진행합니다.
function getProductDisplaySections(product) {
    const rawValues = [];
    if (Array.isArray(product.display_sections)) rawValues.push(...product.display_sections);
    if (product.display_section) rawValues.push(product.display_section);
    const details = product.details || "";
    const tagMatch = details.match(/\[진열구역:([^\]]+)\]/);
    if (tagMatch) rawValues.push(...tagMatch[1].split(","));
    return rawValues
        .flatMap(value => String(value || "").split(","))
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => {
            if (value === "신상품") return "new";
            if (value === "베스트상품") return "best";
            if (value === "추천상품") return "featured";
            return value;
        });
}

function productInDisplaySection(product, sectionId) {
    return getProductDisplaySections(product).includes(sectionId);
}

function renderProductCards(products) {
    // 3가지 렌더링 타겟 컨테이너 로드
    const grid = document.getElementById("product-grid");
    const newSlider = document.getElementById("new-arrivals-slider");
    const bestGrid = document.getElementById("best-seller-grid");
    
    if (!grid) return;
    
    // 로딩 및 기존 내용 청소
    grid.innerHTML = "";
    if (newSlider) newSlider.innerHTML = "";
    if (bestGrid) bestGrid.innerHTML = "";
    
    // 👑 [신설] 필터(브랜드, 검색어, 카테고리) 활성화 여부 판별
    const isFilterActive = (selectedBrand !== "") || (searchQuery !== "") || (currentCategory !== "All");
    
    // 타겟 구역들의 DOM 엘리먼트 로드
    const newSection = document.getElementById("main-new-arrivals-section");
    const bestSection = document.getElementById("main-weekly-best-section");
    const storySections = document.querySelectorAll(".shop-story-section"); // 홈 화면 및 상세 하단 스토리 에디토리얼 카드들
    const heroBanner = document.getElementById("hero-banner");
    
    if (isFilterActive) {
        // 1. 특정 브랜드/검색/카테고리가 선택된 "전용 필터링 전시장" 모드일 때 ➡️ 불필요 섹션 전면 숨김
        if (newSection) newSection.style.display = "none";
        if (bestSection) bestSection.style.display = "none";
        if (heroBanner) heroBanner.style.display = "none"; // 슬라이드 메인 배너도 브랜드 뷰포트에선 숨김
        
        storySections.forEach(section => {
            // 상세페이지 하단에 붙은 배너는 놔두고, 홈 화면(.page-view 내부)의 스토리 배너만 골라 안전하게 가림
            if (section.closest('#view-home')) {
                section.style.display = "none";
            }
        });
    } else {
        // 2. 필터가 하나도 걸리지 않은 순수한 최초 "전체보기 홈" 모드일 때 ➡️ 웅장한 섹션들 복원
        if (newSection) newSection.style.display = "block";
        if (bestSection) bestSection.style.display = "block";
        if (heroBanner && document.getElementById("view-home").style.display === "block") {
            heroBanner.style.display = "flex"; // 홈 탭 활성화 중에만 노출
        }
        storySections.forEach(section => {
            section.style.display = "block";
        });
    }
    
    if (products.length === 0) {
        grid.innerHTML = `<div class="loading-box" style="grid-column: 1/-1; padding: 60px 0; color: var(--text-secondary); font-size:12.5px;">현재 검색 조건에 부합하는 컬렉션이 존재하지 않습니다. 🧥</div>`;
        
        // 검색 결과가 없을 때는 페이지네이션 영역도 깨끗이 비워 줍니다.
        const pagContainer = document.getElementById("product-pagination");
        if (pagContainer) pagContainer.innerHTML = "";
        return;
    }

    // 🔒 [기획 A] 필터가 없을 때만 NEW ARRIVALS: 최신 가시 상품 20개 추출하여 가로 슬라이더 채우기
    if (newSlider && !isFilterActive) {
        const visibleProducts = products.filter(p => p.is_visible !== false);
        const assignedNewProducts = visibleProducts.filter(p => productInDisplaySection(p, "new"));
        const newProducts = (assignedNewProducts.length ? assignedNewProducts : visibleProducts).slice(0, 20);
        
        newProducts.forEach(p => {
            const card = createSingleProductCard(p, false, 0);
            newSlider.appendChild(card);
        });
    }

    // 🔒 [기획 B] 필터가 없을 때만 WEEKLY BEST SELLER: 상위 4개 제품 추출하여 랭킹 딱지와 함께 4열 그리드 채우기
    if (bestGrid && !isFilterActive) {
        const visibleProducts = products.filter(p => p.is_visible !== false);
        const assignedBestProducts = visibleProducts.filter(p => productInDisplaySection(p, "best"));
        const bestProducts = (assignedBestProducts.length ? assignedBestProducts : visibleProducts).slice(0, 4);
        
        bestProducts.forEach((p, idx) => {
            const card = createSingleProductCard(p, true, idx + 1);
            bestGrid.appendChild(card);
        });
    }
    
    // 🔒 [기획 C] EXCLUSIVE COLLECTION: 전체 상품 그리드 렌더링 (30개씩 잘라서 로컬 페이지네이션 처리 - 항상 작동)
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = currentPage * itemsPerPage;
    const pagedProducts = products.slice(startIdx, endIdx);
    
    pagedProducts.forEach(p => {
        const card = createSingleProductCard(p, false, 0);
        grid.appendChild(card);
    });

    // 👑 [신설] 5단 슬라이딩 페이지네이션 컨트롤러 렌더링 호출
    renderPaginationControls(products.length);
}

// 👑 [신설] 5단 슬라이딩 미니멀 페이지네이션 렌더링 엔진 (대표님 교육용 한글 주석 완비)
function renderPaginationControls(totalItems) {
    const container = document.getElementById("product-pagination");
    if (!container) return;
    container.innerHTML = "";
    
    // 필요한 전체 페이지 수 계산 (예: 1만 개 / 30개 = 334 페이지)
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        return; // 전체 페이지가 1개뿐이면 번호판을 그리지 않고 조용히 퇴장합니다.
    }
    
    // 하단 번호판에 보여줄 숫자의 밴드 크기 (5단 고정)
    const pageGroupSize = 5;
    // 현재 페이지가 속한 그룹 번호 (예: 3페이지는 1그룹, 7페이지는 2그룹)
    const currentGroup = Math.ceil(currentPage / pageGroupSize);
    
    // 번호판의 시작 번호와 끝 번호 계산 (예: 2그룹인 경우 6번부터 10번까지)
    const startPage = (currentGroup - 1) * pageGroupSize + 1;
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);
    
    // [Prev] 이전 단추 생성 (1그룹이 아닐 때만 작동)
    const prevBtn = document.createElement("button");
    prevBtn.className = "pag-btn pag-text-btn";
    prevBtn.textContent = "Prev";
    prevBtn.disabled = currentGroup === 1;
    prevBtn.onclick = () => {
        currentPage = startPage - 1; // 이전 그룹의 마지막 페이지로 점프
        executeFilterAndSort();
        scrollToProducts();
    };
    container.appendChild(prevBtn);
    
    // 숫자 페이지 번호 단추들 생성
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement("button");
        btn.className = `pag-btn ${i === currentPage ? 'active' : ''}`;
        btn.textContent = i;
        btn.onclick = () => {
            currentPage = i;
            executeFilterAndSort();
            scrollToProducts();
        };
        container.appendChild(btn);
    }
    
    // [Next] 다음 단추 생성 (마지막 그룹이 아닐 때만 작동)
    const nextBtn = document.createElement("button");
    nextBtn.className = "pag-btn pag-text-btn";
    nextBtn.textContent = "Next";
    nextBtn.disabled = endPage === totalPages;
    nextBtn.onclick = () => {
        currentPage = endPage + 1; // 다음 그룹의 첫 페이지로 점프
        executeFilterAndSort();
        scrollToProducts();
    };
    container.appendChild(nextBtn);
}

// 👑 [신설] 페이지 이동 시 필터바로 부드럽게 화면을 올려주는 스크롤 헬퍼 함수
function scrollToProducts() {
    const filterBar = document.getElementById("main-shop-filter-bar");
    if (filterBar) {
        filterBar.scrollIntoView({ behavior: "smooth" });
    }
}

// 개별 상품 카드 마크업을 동적 생성하는 공통 모듈화 함수 (랭킹 배지 주입 기능 추가)
function createSingleProductCard(p, isBest = false, rankNum = 0) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.onclick = () => showProductDetail(p.id);
    
    // 품절 오버레이
    let soldOutOverlay = "";
    let blackWhiteClass = "";
    const isSoldOut = !p.is_visible || p.is_soldout || (p.stock !== undefined && p.stock <= 0);
    if (isSoldOut) {
        soldOutOverlay = `
            <div class="soldout-overlay">
                <span class="soldout-badge">SOLD OUT</span>
            </div>
        `;
        blackWhiteClass = "sold-out-bw";
    }
    
    // 찜하기 여부
    const isWished = wishlist.includes(p.id) ? "♥" : "♡";
    const wishActive = wishlist.includes(p.id) ? "active" : "";
    
    // 이미지 소스
    const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
    
    // 랭킹 배지 마크업 생성
    let rankBadgeMarkup = "";
    if (isBest && rankNum > 0) {
        const strRank = String(rankNum).padStart(2, '0');
        rankBadgeMarkup = `<div class="best-rank-badge">${strRank}</div>`;
    }
    
    card.innerHTML = `
        <div class="product-image-box ${blackWhiteClass}">
            ${rankBadgeMarkup} <!-- 랭킹 배지 동적 삽입 -->
            <!-- 🎨 [디자인 보완] 상품 이미지가 깨지거나 유실되었을 경우를 대비하여 세련된 대체 가방 이미지(Unsplash 소스)가 출력되도록 onerror 예방 조치 추가 -->
            <img src="${repImg}" loading="lazy" alt="${p.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=600&auto=format&fit=crop&q=60'; this.classList.add('image-err-fallback');">
            ${soldOutOverlay}
            <button class="wish-btn ${wishActive}" onclick="toggleWishlist('${p.id}', event)">
                ${isWished}
            </button>
        </div>
        <div class="product-info-box">
            <span class="prod-brand-lbl">${p.brand}</span>
            <h4 class="prod-name-lbl">${p.name}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span class="prod-original-price" style="text-decoration:line-through; font-size:10px; color:#aaa; font-family:var(--font-outfit);">${p.original_price || ""}</span>
                <span class="prod-price-lbl" style="font-family:var(--font-outfit);">₩${p.selling_price.toLocaleString()}</span>
            </div>
        </div>
    `;
    
    return card;
}

function renderWishlistPage() {
    const grid = document.getElementById("wishlist-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    // 찜한 상품들만 전체 상품 리스트에서 필터링
    const wishedProducts = allProducts.filter(p => wishlist.includes(p.id));
    
    if (wishedProducts.length === 0) {
        grid.innerHTML = `
            <div class="loading-box" style="grid-column: 1/-1; padding: 100px 0; text-align: center;">
                <p style="color: var(--text-secondary); font-size:13.5px; line-height:1.8;">
                    찜해두신 명품 컬렉션이 없습니다. 🤍<br><br>
                    마음에 드는 상품 카드 우측 상단의 하트 아이콘을 눌러 소중히 채워보세요!
                </p>
            </div>
        `;
        return;
    }
    
    wishedProducts.forEach(p => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.onclick = () => showProductDetail(p.id);
        
        let soldOutOverlay = "";
        let blackWhiteClass = "";
        const isSoldOut = !p.is_visible || p.is_soldout || (p.stock !== undefined && p.stock <= 0);
        if (isSoldOut) {
            soldOutOverlay = `<div class="soldout-overlay"><span class="soldout-badge">SOLD OUT</span></div>`;
            blackWhiteClass = "sold-out-bw";
        }
        
        const isWished = wishlist.includes(p.id) ? "♥" : "♡";
        const wishActive = wishlist.includes(p.id) ? "active" : "";
        const repImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800";
        
        card.innerHTML = `
            <div class="product-image-box ${blackWhiteClass}">
                <img src="${repImg}" loading="lazy" alt="${p.name}">
                ${soldOutOverlay}
                <button class="wishlist-heart-btn ${wishActive}" onclick="toggleWishlist('${p.id}', event)">
                    ${isWished}
                </button>
            </div>
            <div class="product-info-box">
                <span class="prod-brand-lbl">${p.brand}</span>
                <h4 class="prod-name-lbl">${p.name}</h4>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                    <span class="prod-original-price" style="text-decoration:line-through; font-size:10px; color:#aaa; font-family:var(--font-outfit);">${p.original_price || ""}</span>
                    <span class="prod-price-lbl" style="font-family:var(--font-outfit);">₩${p.selling_price.toLocaleString()}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 2. [공지사항 & 이벤트 게시판 아코디언 빌더]
let currentNoticeFilter = "all";

