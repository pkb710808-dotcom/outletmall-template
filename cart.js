// [보안 고도화] 주문 다중 제출(연타 결제 및 적립금 중복 소진) 방지용 락 플래그
let isOrderSubmitting = false;

/**
 * 🎭 [추가 고도화] 브라우저 기본 confirm 팝업을 대체하여 비동기(Promise) 방식으로
 * 커스텀 컨펌 모달을 화면에 띄우고 확인/취소 값을 반환하는 공용 함수
 * @param {string} message - 모달 창에 띄울 안내 텍스트 문구
 * @returns {Promise<boolean>} - 확인 시 true, 취소 시 false 반환
 */
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById("custom-confirm-modal");
        const msgEl = document.getElementById("custom-confirm-message");
        const okBtn = document.getElementById("custom-confirm-ok-btn");
        const cancelBtn = document.getElementById("custom-confirm-cancel-btn");

        if (!modal || !msgEl || !okBtn || !cancelBtn) {
            // 구조가 유실되었을 경우의 대비용 Fallback
            resolve(confirm(message));
            return;
        }

        // 1. 메시지 주입 및 모달 디스플레이 켬
        msgEl.innerHTML = message.replace(/\n/g, "<br>");
        modal.style.display = "flex";

        // 2. 버튼 클릭 핸들러 바인딩 (이전 핸들러와 꼬이지 않도록 일회용 클린업 적용)
        const cleanupAndClose = (result) => {
            modal.style.display = "none";
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanupAndClose(true);
        cancelBtn.onclick = () => cleanupAndClose(false);
    });
}

// =========================================================================
// 5. [🎟️ 가상 적립금 & 할인 쿠폰 입력 폼 & 결제단 금액 연산 이식]
// =========================================================================
let pointsUsed = 0;
let couponDiscount = 0;

function useAllPoints() {
    const points = userProfile ? userProfile.points : 3000;
    document.getElementById("order-points-use").value = points;
    calculateFinalPrice();
}

// [보안 고도화] 할인 쿠폰 검증 시 평문 코드 하드코딩 유출 차단 (CryptoJS SHA-256 해시 검증)
function applyDiscountCoupon() {
    const couponInput = document.getElementById("order-coupon").value.trim();
    const successMsg = document.getElementById("coupon-success-msg");
    
    // 입력한 쿠폰 번호의 SHA-256 해시 연산
    const inputHash = CryptoJS.SHA256(couponInput).toString();
    // 비공개 골드 쿠폰 코드의 암호화 해시값 대조 (평문 노출 완벽 예방)
    const goldCouponHash = "2682be2b601066ebab191096cb493aa9e457a3d527673201e7f430011d2c86b2";
    
    if (inputHash === goldCouponHash) {
        couponDiscount = 0.05;
        if (successMsg) successMsg.style.display = "block";
        alert("🎟️ 5% 추가 할인 쿠폰이 주문금액에 반영되었습니다!");
    } else {
        couponDiscount = 0;
        if (successMsg) successMsg.style.display = "none";
        alert("❌ 올바르지 않거나 이미 만료된 쿠폰 번호입니다!");
    }
    calculateFinalPrice();
}

function calculateFinalPrice() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const pointsInput = parseInt(document.getElementById("order-points-use").value) || 0;
    const maxPoints = userProfile ? userProfile.points : 3000;
    
    if (pointsInput > maxPoints) {
        alert(`보유하신 최대 적립금인 ${maxPoints.toLocaleString()}원 범위 내에서만 사용 가능합니다!`);
        document.getElementById("order-points-use").value = maxPoints;
        pointsUsed = maxPoints;
    } else if (pointsInput < 0) {
        document.getElementById("order-points-use").value = 0;
        pointsUsed = 0;
    } else {
        pointsUsed = pointsInput;
    }
    
    const couponCut = Math.floor(subtotal * couponDiscount);
    const totalDiscount = pointsUsed + couponCut;
    
    let finalPrice = subtotal - totalDiscount;
    if (finalPrice < 0) finalPrice = 0;
    
    document.getElementById("checkout-subtotal-price").textContent = `₩${subtotal.toLocaleString()}`;
    document.getElementById("checkout-discount-price").textContent = `- ₩${totalDiscount.toLocaleString()}`;
    document.getElementById("checkout-total-price").textContent = `₩${finalPrice.toLocaleString()}`;
}

// =========================================================================
// 6. [↩️ 마이페이지 내 주문 취소/반품/교환 클레임 접수 프로세스]
// =========================================================================
async function requestClaim(orderId, orderNo, type) {
    const reason = prompt(`↩️ [${orderNo}] ${type}을(를) 신청하시는 사유를 입력해 주세요:\n(사유를 입력하시면 즉시 대표님 대장에 실시간 접수됩니다.)`);
    if (!reason) return;
    
    const statusMap = {
        "주문취소": "주문취소",
        "반품신청": "반품요청",
        "교환신청": "교환요청"
    };
    
    const newStatus = statusMap[type] || "주문취소";
    const claimMemo = `[클레임 사유: ${type} - ${reason}]`;
    
    if (supabaseClient) {
        try {
            const currentOrder = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("message")
                .eq("id", orderId)
                .single());
                
            const newMsg = currentOrder?.data?.message ? `${currentOrder.data.message} ${claimMemo}` : claimMemo;
            
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .update({ status: newStatus, message: newMsg })
                .eq("id", orderId));
                
            if (error) throw error;
            alert(`🎉 [${type}] 요청서가 정상 접수되었습니다.`);
            fetchUserOrders();
        } catch (e) {
            alert(`⚠️ 클레임 접수 중 오류: ${e.message}`);
        }
    } else {
        const idx = DUMMY_ORDERS.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            DUMMY_ORDERS[idx].status = newStatus;
            DUMMY_ORDERS[idx].message = DUMMY_ORDERS[idx].message ? `${DUMMY_ORDERS[idx].message} ${claimMemo}` : claimMemo;
        }
        alert(`🎁 [더미 모드] [${type}] 가상 접수 완료!`);
        fetchUserOrders();
    }
}

function toggleCashReceiptForm(show) {
    document.getElementById("cash-receipt-form").style.display = show ? "block" : "none";
}

// =========================================================================
// 🛒 [장바구니 스토리지 보존 및 실시간 렌더링 세부 함수군]
// =========================================================================

// 장바구니 데이터를 브라우저 로컬 저장소(localStorage)에 동기화
function saveCartToStorage() {
    safeLocalStorage.setItem("pkb71_cart", JSON.stringify(cart));
    updateHeaderCartCount();
}

// 브라우저 켤 때 로컬 저장소로부터 기존 장바구니 복원
function loadCartFromStorage() {
    try {
        const saved = safeLocalStorage.getItem("pkb71_cart");
        if (saved) {
            cart = JSON.parse(saved);
        }
    } catch(e) {
        cart = [];
    }
    updateHeaderCartCount();
}

// 상단 우측 쇼핑백(CART) 아이콘의 담긴 상품 개수 빨간 배지 동적 업데이트
function updateHeaderCartCount() {
    const countEl = document.getElementById("header-cart-count");
    if (countEl) {
        const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
        countEl.textContent = totalQty;
    }
}

// 장바구니 모달 창 켜고 끄기 토글 제어
function toggleCartModal() {
    const modal = document.getElementById("cart-modal");
    if (modal) {
        if (modal.style.display === "flex") {
            modal.style.display = "none";
        } else {
            renderCartModalItems();
            modal.style.display = "flex";
        }
    }
}

// 장바구니 모달 창 외부(어두운 투명 배경) 클릭 시 자동으로 자연스럽게 닫기
function closeCartModalOutside(event) {
    if (event.target.id === "cart-modal") {
        document.getElementById("cart-modal").style.display = "none";
    }
}

// 장바구니 리스트를 모달 창 내부에 정밀 마크업하여 실시간 반영
function renderCartModalItems() {
    const list = document.getElementById("cart-modal-items-list");
    const totalEl = document.getElementById("cart-modal-total-price");
    if (!list) return;
    
    list.innerHTML = "";
    let totalPrice = 0;
    
    if (cart.length === 0) {
        list.innerHTML = `<p class="quick-empty-text" style="padding: 40px 0;">장바구니가 조용히 비어 있습니다. 🧥🛍️</p>`;
        if (totalEl) totalEl.textContent = "₩0";
        return;
    }
    
    cart.forEach(item => {
        const itemPrice = item.price * item.qty;
        totalPrice += itemPrice;
        
        const div = document.createElement("div");
        // 럭셔리 그리드 이식에 준하는 디테일한 인라인 폼 스타일링
        div.className = "cart-item-row";
        div.style = "display: flex; gap: 12px; margin-bottom: 16px; border-bottom: 1px solid #f1f0ee; padding-bottom: 12px; align-items: center;";
        div.innerHTML = `
            <img src="${item.thumb}" style="width: 50px; height: 65px; object-fit: cover; border-radius: 4px;" />
            <div style="flex: 1; font-size: 12px; line-height: 1.4;">
                <h4 style="margin: 0 0 3px 0; font-size: 12px; font-weight: 700; color: var(--text-primary);">[${item.brand}] ${item.name}</h4>
                <p style="margin: 0 0 5px 0; color: var(--text-secondary); font-size: 10.5px;">옵션: ${item.color} / ${item.size}</p>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button onclick="changeCartQty('${item.cartItemId}', -1)" style="border: 1px solid #ddd; background: #fff; padding: 1px 6px; cursor: pointer; border-radius: 2px; font-size: 11px; font-weight:700;">-</button>
                    <span style="font-weight: 700; min-width: 15px; text-align: center; font-size:11.5px;">${item.qty}</span>
                    <button onclick="changeCartQty('${item.cartItemId}', 1)" style="border: 1px solid #ddd; background: #fff; padding: 1px 6px; cursor: pointer; border-radius: 2px; font-size: 11px; font-weight:700;">+</button>
                </div>
            </div>
            <div style="text-align: right; font-size: 12.5px; font-weight: 700; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                <span>₩${itemPrice.toLocaleString()}</span>
                <button onclick="removeCartItem('${item.cartItemId}')" style="background: none; border: none; color: #D32F2F; cursor: pointer; font-size: 10px; text-decoration: underline; padding:0;">삭제</button>
            </div>
        `;
        list.appendChild(div);
    });
    
    if (totalEl) totalEl.textContent = `₩${totalPrice.toLocaleString()}`;
}

// 장바구니 수량 실시간 가감 (+/-) 제어
async function changeCartQty(cartItemId, amount) {
    const itemIndex = cart.findIndex(item => item.cartItemId === cartItemId);
    if (itemIndex !== -1) {
        cart[itemIndex].qty += amount;
        if (cart[itemIndex].qty <= 0) {
            const isConfirmed = await showCustomConfirm("해당 명품 의류를 장바구니에서 완전히 제외하시겠습니까?");
            if (isConfirmed) {
                cart.splice(itemIndex, 1);
            } else {
                cart[itemIndex].qty = 1;
            }
        }
        saveCartToStorage();
        renderCartModalItems();
    }
}

// 장바구니 특정 품목 완전 삭제
function removeCartItem(cartItemId) {
    const itemIndex = cart.findIndex(item => item.cartItemId === cartItemId);
    if (itemIndex !== -1) {
        cart.splice(itemIndex, 1);
        saveCartToStorage();
        renderCartModalItems();
    }
}

// =========================================================================
// 📝 [주문서 작성 페이지 전환 및 주소 자동완성(Autofill) 컴포넌트]
// =========================================================================

// 주문서 작성(Checkout) 화면 이동 및 회원 정보 자동 이식
function goToCheckout() {
    if (cart.length === 0) {
        alert("장바구니가 고요히 비어 있습니다. 명품을 먼저 골라 담아주세요! 🛍️");
        return;
    }
    
    // 열려 있는 카트 모달 강제 닫기
    const modal = document.getElementById("cart-modal");
    if (modal) modal.style.display = "none";
    
    // 🔒 [보안 & 편리] 로그인 회원 정보 배송지 자동 완성 (Autofill) 처리
    if (currentUser && userProfile) {
        document.getElementById("order-customer-name").value = userProfile.name || "";
        document.getElementById("order-phone").value = userProfile.phone || "";
        document.getElementById("order-postcode").value = userProfile.postcode || "";
        document.getElementById("order-address").value = userProfile.address || "";
        document.getElementById("order-address-detail").value = userProfile.address_detail || "";
        document.getElementById("order-depositor").value = userProfile.name || "";
    } else {
        document.getElementById("order-customer-name").value = "";
        document.getElementById("order-phone").value = "";
        document.getElementById("order-postcode").value = "";
        document.getElementById("order-address").value = "";
        document.getElementById("order-address-detail").value = "";
        document.getElementById("order-depositor").value = "";
    }
    
    // 적립금과 쿠폰 초기 셋업 복원
    pointsUsed = 0;
    couponDiscount = 0;
    document.getElementById("order-points-use").value = "";
    document.getElementById("order-coupon").value = "";
    const successMsg = document.getElementById("coupon-success-msg");
    if (successMsg) successMsg.style.display = "none";
    
    // 사용 가능한 보유 적립금 동적 표시
    const myPointsEl = document.getElementById("checkout-my-points");
    if (myPointsEl) {
        const points = userProfile?.points !== undefined ? userProfile.points : 3000;
        myPointsEl.textContent = points.toLocaleString();
    }
    
    renderCheckoutSummary();
    calculateFinalPrice();
    navigateTo('checkout');
}

// 결제 요약란에 상품 상세 목록 구성
// 🛡️ [UX 고도화] 결제 화면 내 우측 주문서 요약 카드를 럭셔리한 규격 스타일로 렌더링합니다.
function renderCheckoutSummary() {
    const container = document.getElementById("checkout-items-summary");
    if (!container) return;
    container.innerHTML = "";
    
    cart.forEach(item => {
        const div = document.createElement("div");
        div.className = "checkout-summary-item"; // 신설된 CSS 클래스 바인딩
        div.innerHTML = `
            <img src="${item.thumb}" alt="${item.name}" />
            <div class="checkout-summary-item-info">
                <span class="checkout-summary-item-name">[${item.brand}] ${item.name}</span>
                <p class="checkout-summary-item-meta">옵션: ${item.color} / ${item.size} (${item.qty}개)</p>
            </div>
            <div class="checkout-summary-item-price">
                ₩${(item.price * item.qty).toLocaleString()}
            </div>
        `;
        container.appendChild(div);
    });
}

// Daum 주소 검색 엔진 API 스크립트 동적 인젝션
function injectDaumPostcodeScript() {
    if (document.getElementById("daum-postcode-script")) return;
    const script = document.createElement("script");
    script.id = "daum-postcode-script";
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    document.head.appendChild(script);
}

// 📮 Daum/카카오 우편번호 및 도로명 주소 찾기 팝업 연동
function samplePostcodeSearch(type) {
    if (typeof daum === "undefined" || typeof daum.Postcode === "undefined") {
        alert("우편번호 서비스 스크립트가 아직 로드 중입니다. 0.5초만 이따가 다시 클릭해 주세요! 📮");
        return;
    }
    
    new daum.Postcode({
        oncomplete: function(data) {
            let addr = ''; // 주소 변수
            
            if (data.userSelectedType === 'R') { // 도로명 주소 선택
                addr = data.roadAddress;
            } else { // 지번 주소 선택
                addr = data.jibunAddress;
            }
            
            if (type === 'order') {
                document.getElementById("order-postcode").value = data.zonecode;
                document.getElementById("order-address").value = addr;
                document.getElementById("order-address-detail").focus();
            } else if (type === 'mypage') {
                document.getElementById("my-postcode").value = data.zonecode;
                document.getElementById("my-address").value = addr;
                document.getElementById("my-address-detail").focus();
            }
        }
    }).open();
}

// 무통장 입금 전용 주문 최종 수렴 처리 (영수증 및 적립금 반영)
// 무통장 입금 전용 주문 최종 수렴 처리 (영수증 및 적립금 반영)
// [보안 고도화] 결제 금액 위조 및 적립금 오버플로우 방어용 실시간 교차 검증 적용
async function submitFinalOrder() {
    if (isOrderSubmitting) {
        console.warn("⚠️ 주문 접수가 이미 처리 중입니다. 중복 제출 차단.");
        return;
    }
    
    const name = document.getElementById("order-customer-name").value.trim();
    const phone = document.getElementById("order-phone").value.trim();
    const postcode = document.getElementById("order-postcode").value.trim();
    const address = document.getElementById("order-address").value.trim();
    const addressDetail = document.getElementById("order-address-detail").value.trim();
    const depositor = document.getElementById("order-depositor").value.trim();
    const msgInput = document.getElementById("order-message").value.trim();
    
    if (!name || !phone || !postcode || !address || !addressDetail || !depositor) {
        alert("원활한 신속 배송 접수를 위해 필수 정보(*)를 모두 정확하게 채워주세요! 📝");
        return;
    }

    // 📞 [보안/유효성 검증] 휴대폰 번호 형식 정규식 검사 (010-1234-5678 형태 또는 10~11자리 숫자 체크)
    const phoneRegex = /^(010[-. ]?[0-9]{3,4}[-. ]?[0-9]{4}|01[1|6|7|8|9][-. ]?[0-9]{3,4}[-. ]?[0-9]{4})$/;
    const cleanPhone = phone.replace(/[^0-9]/g, ""); // 검증을 위해 하이픈 등 기호 제외 숫자만 추출
    if (!phoneRegex.test(phone) || cleanPhone.length < 10 || cleanPhone.length > 11) {
        alert("📞 올바른 휴대폰 번호 형식을 입력해 주세요! (예: 010-1234-5678)");
        return;
    }
    
    // 락 획득
    isOrderSubmitting = true;
    
    // 대표님의 기획 요청으로 현금영수증 발행 로직은 사용하지 않으므로 제거하고 배송 메시지만 안전하게 주입합니다.
    let finalMessage = msgInput;
    
    // 🛡️ [보안 가드 1단계] 클라우드 DB 연동 시, 회원의 실제 포인트 보유 한도를 더블체크하여 변조 시도 원천 차단
    if (supabaseClient && currentUser && pointsUsed > 0) {
        try {
            const { data: realProfile, error: getPointsErr } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("points")
                .eq("id", currentUser.id)
                .single());
            if (getPointsErr) throw getPointsErr;
            
            const dbPoints = realProfile ? (realProfile.points || 0) : 0;
            if (pointsUsed > dbPoints) {
                alert("🚨 [경고] 보유하신 한도 이상의 적립금 사용은 불가능합니다! (데이터 조작 감지)");
                pointsUsed = dbPoints; // 안전 값 강제 보정
                calculateFinalPrice();
                isOrderSubmitting = false; // 락 해제
                return;
            }
        } catch(e) {
            console.warn("⚠️ 실시간 보유 적립금 교차 대조 실패:", e.message);
        }
    }
    
    // 🛡️ [보안 가드 2단계] 장바구니에 담긴 상품 단가의 클라이언트 변조를 방지하기 위해 DB상의 진짜 단가로 일괄 재조회 및 가격 재합산
    let verifiedSubtotal = 0;
    let dbProducts = []; // 재고 감산을 위해 전역/지역 배열 보관
    
    if (supabaseClient) {
        try {
            const prodIds = cart.map(item => item.prodId).filter(id => id !== undefined);
            if (prodIds.length > 0) {
                const { data, error: dbProdErr } = await timeoutPromise(2500, supabaseClient
                    .from("products")
                    .select("id, name, selling_price, stock, is_soldout")
                    .in("id", prodIds));
                if (dbProdErr) throw dbProdErr;
                dbProducts = data || [];
                
                // 🛡️ [재고/품절 2차 보안 가드] 품절 여부 및 수량 초과 검증 실행
                let stockErrStr = "";
                cart.forEach(item => {
                    const dbProd = dbProducts.find(p => p.id === item.prodId);
                    if (dbProd) {
                        if (dbProd.is_soldout || (dbProd.stock !== undefined && dbProd.stock <= 0)) {
                            stockErrStr += `• [품절] ${item.name} 상품은 품절되어 구매할 수 없습니다.\n`;
                        } else if (dbProd.stock !== undefined && item.qty > dbProd.stock) {
                            stockErrStr += `• [재고 부족] ${item.name} 상품은 현재 재고가 ${dbProd.stock}개 남았습니다. (주문량: ${item.qty}개)\n`;
                        }
                    }
                });
                
                if (stockErrStr) {
                    alert(`🚨 [재고/품절 오류] 아래 상품들의 주문 수량이 초과되었습니다:\n\n${stockErrStr}\n장바구니 수량을 수정한 후 다시 구매를 진행해 주세요!`);
                    isOrderSubmitting = false; // 락 해제
                    return;
                }
                
                cart.forEach(item => {
                    const dbProd = dbProducts.find(p => p.id === item.prodId);
                    const realPrice = dbProd ? dbProd.selling_price : item.price; // 가짜 가격 대신 DB의 진짜 단가 대입
                    
                    // 가짜 단가 감지 시 즉시 실물 단가로 동기화 복구
                    if (item.price !== realPrice) {
                        console.warn(`🚨 [단가 변조 포착] ${item.name} 가격 복구: ₩${item.price} -> ₩${realPrice}`);
                        item.price = realPrice;
                    }
                    verifiedSubtotal += (realPrice * item.qty);
                });
            }
        } catch(e) {
            console.warn("⚠️ 상품 가격 교차 대조 실패 (기존 로직 우회 보완):", e.message);
            verifiedSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        }
    } else {
        // 더미 모드에서의 재고/품절 검증 가드
        let stockErrStr = "";
        cart.forEach(item => {
            const dummyProd = DUMMY_PRODUCTS.find(p => p.id === item.prodId);
            if (dummyProd) {
                if (dummyProd.is_soldout || (dummyProd.stock !== undefined && dummyProd.stock <= 0)) {
                    stockErrStr += `• [품절] ${item.name} 상품은 품절되어 구매할 수 없습니다.\n`;
                } else if (dummyProd.stock !== undefined && item.qty > dummyProd.stock) {
                    stockErrStr += `• [재고 부족] ${item.name} 상품은 현재 재고가 ${dummyProd.stock}개 남았습니다. (주문량: ${item.qty}개)\n`;
                }
            }
        });
        
        if (stockErrStr) {
            alert(`🚨 [재고/품절 오류] 아래 상품들의 주문 수량이 초과되었습니다:\n\n${stockErrStr}`);
            isOrderSubmitting = false; // 락 해제
            return;
        }
        verifiedSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    }
    
    const couponCut = Math.floor(verifiedSubtotal * couponDiscount);
    const discount = pointsUsed + couponCut;
    const finalPrice = Math.max(0, verifiedSubtotal - discount);
    
    const orderNo = `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // 🛡️ [보안 고도화] 메모리 및 로컬 보존용 평문(복호화) 주문 데이터를 조립합니다.
    const orderData = {
        order_no: orderNo,
        customer_name: name,
        phone: phone,
        postcode: postcode,
        address: address,
        address_detail: addressDetail,
        message: finalMessage || null,
        depositor: depositor,
        total_amount: finalPrice,
        items: cart.map(item => ({
            prodId: item.prodId,
            name: item.name,
            brand: item.brand,
            color: item.color,
            size: item.size,
            price: item.price,
            qty: item.qty,
            thumb: item.thumb
        })),
        status: "입금대기",
        user_id: currentUser ? currentUser.id : "guest-user",
        created_at: new Date().toISOString()
    };
    
    // 🛡️ [보안 고도화] DB 업로드 전송 전용 암호화된 주문 데이터를 조립합니다.
    const encryptedOrderData = {
        ...orderData,
        customer_name: secureEncrypt(name),
        phone: secureEncrypt(phone),
        postcode: secureEncrypt(postcode),
        address: secureEncrypt(address),
        address_detail: secureEncrypt(addressDetail),
        depositor: secureEncrypt(depositor)
    };
    
    if (supabaseClient) {
        try {
            // DB에는 개인정보가 암호화된 주문 데이터를 적재합니다.
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .insert([encryptedOrderData]));
                
            if (error) throw error;
            
            // 보유 적립금 정상 소진 반영
            if (currentUser && userProfile && pointsUsed > 0) {
                const nextPoints = Math.max(0, userProfile.points - pointsUsed);
                await timeoutPromise(2500, supabaseClient
                    .from("profiles")
                    .update({ points: nextPoints })
                    .eq("id", currentUser.id));
                userProfile.points = nextPoints;
            }
            
            // 🛡️ [재고/품절 고도화] 상품 DB 재고 자동 차감 및 품절 업데이트
            for (const item of cart) {
                const dbProd = dbProducts.find(p => p.id === item.prodId);
                if (dbProd && dbProd.stock !== undefined) {
                    const nextStock = Math.max(0, dbProd.stock - item.qty);
                    const isSoldOutNext = nextStock <= 0;
                    await timeoutPromise(2500, supabaseClient
                        .from("products")
                        .update({ stock: nextStock, is_soldout: isSoldOutNext })
                        .eq("id", item.prodId));
                }
            }
            
            alert(`🎉 주문 접수가 안전 완료되었습니다!\n주문번호: ${orderNo}\n24시간 이내에 ₩${finalPrice.toLocaleString()}원을 국민은행 계좌로 입금해 주세요. 🫡`);
            cart = [];
            saveCartToStorage();
            navigateTo('mypage');
        } catch(e) {
            alert(`⚠️ 주문서 저장 중 클라우드 오류: ${e.message}`);
        } finally {
            isOrderSubmitting = false; // 락 해제
        }
    } else {
        // 더미 백오피스 통합 장부에 기록 보존
        const copyOrder = { ...orderData, id: `order-${Math.floor(Math.random()*100000)}` };
        DUMMY_ORDERS.unshift(copyOrder);
        
        if (currentUser && userProfile && pointsUsed > 0) {
            userProfile.points = Math.max(0, userProfile.points - pointsUsed);
            safeLocalStorage.setItem("pkb71_mock_profile", JSON.stringify(userProfile));
        }
        
        // 더미 모드에서도 가상 상품 재고 차감 및 품절 갱신
        cart.forEach(item => {
            const dummyIdx = DUMMY_PRODUCTS.findIndex(p => p.id === item.prodId);
            if (dummyIdx !== -1 && DUMMY_PRODUCTS[dummyIdx].stock !== undefined) {
                DUMMY_PRODUCTS[dummyIdx].stock = Math.max(0, DUMMY_PRODUCTS[dummyIdx].stock - item.qty);
                if (DUMMY_PRODUCTS[dummyIdx].stock <= 0) {
                    DUMMY_PRODUCTS[dummyIdx].is_soldout = true;
                }
            }
        });
        allProducts = [...DUMMY_PRODUCTS];
        
        alert(`🎁 [더미 오피스 접수 완료]\n주문번호: ${orderNo}\n₩${finalPrice.toLocaleString()}원 입금이 감지되는 즉시 배송이 가동됩니다!`);
        cart = [];
        saveCartToStorage();
        if (currentUser) {
            navigateTo('mypage');
        } else {
            navigateTo('home');
        }
        isOrderSubmitting = false; // 락 해제
    }
}

// 🛡️ [보안/편의 고도화] 장바구니 전체 품목을 일괄 제거하는 API
async function clearCart() {
    if (cart.length === 0) {
        alert("장바구니가 이미 비어있습니다. 🧥");
        return;
    }
    const isConfirmed = await showCustomConfirm("장바구니에 담긴 모든 상품을 정말로 비우시겠습니까?");
    if (isConfirmed) {
        cart = [];
        saveCartToStorage();
        renderCartModalItems();
        alert("🗑️ 장바구니가 완전히 비워졌습니다.");
    }
}

