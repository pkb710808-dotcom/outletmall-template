// =========================================================================
// 2. [🔒 Supabase Auth & 더미 회원가입 / 로그인 통합 처리 엔진]
// =========================================================================
function openAuthModal(mode = 'signin') {
    const modal = document.getElementById("auth-modal");
    const title = document.getElementById("auth-modal-title");
    const signupFields = document.getElementById("auth-signup-fields");
    const submitBtn = document.getElementById("auth-submit-btn");
    const switchPrompt = document.getElementById("auth-switch-prompt");
    const switchLink = document.getElementById("auth-switch-link");
    const errorMsg = document.getElementById("auth-error-msg");
    const inlineError = document.getElementById("auth-inline-error");
    
    document.getElementById("auth-email").value = "";
    document.getElementById("auth-password").value = "";
    document.getElementById("auth-name").value = "";
    document.getElementById("auth-phone").value = "";
    if (errorMsg) errorMsg.style.display = "none";
    if (inlineError) {
        inlineError.textContent = "";
        inlineError.style.display = "none";
    }
    
    if (mode === 'signup') {
        title.textContent = "SIGN UP (회원가입)";
        if (signupFields) signupFields.style.display = "block";
        submitBtn.textContent = "회원가입 완료하기";
        switchPrompt.textContent = "이미 계정이 있으신가요?";
        switchLink.textContent = "로그인하기";
        switchLink.setAttribute("onclick", "openAuthModal('signin')");
    } else {
        title.textContent = "LOGIN (로그인)";
        if (signupFields) signupFields.style.display = "none";
        submitBtn.textContent = "안전하게 로그인하기";
        switchPrompt.textContent = "아직 계정이 없으신가요?";
        switchLink.textContent = "회원가입하기";
        switchLink.setAttribute("onclick", "openAuthModal('signup')");
    }
    
    modal.style.display = "flex";
}

function closeAuthModal() {
    document.getElementById("auth-modal").style.display = "none";
}

function closeAuthModalOutside(event) {
    if (event.target.id === "auth-modal") {
        closeAuthModal();
    }
}

function handleAuthKeyUp(event) {
    if (event.key === "Enter") {
        handleAuthSubmit();
    }
}

function switchAuthMode() {
    const title = document.getElementById("auth-modal-title").textContent;
    if (title.includes("LOGIN") || title.includes("로그인")) {
        openAuthModal('signup');
    } else {
        openAuthModal('signin');
    }
}

async function handleAuthSubmit() {
    const title = document.getElementById("auth-modal-title").textContent;
    const isSignUp = title.includes("회원가입") || title.includes("SIGN UP");
    
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();
    const phone = document.getElementById("auth-phone").value.trim();
    
    if (!email || !password) {
        showAuthError("이메일 주소와 비밀번호는 필수 입력 항목입니다!");
        return;
    }
    // 🛡️ [보안 고도화] 회원가입 시에만 단순 패스워드 방지를 위해 영문과 숫자를 각각 1자 이상 결합한 최소 6자 조합 정규식 적용
    if (isSignUp) {
        const pwRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
        if (!pwRegex.test(password)) {
            showAuthError("비밀번호는 보안을 위해 영문과 숫자를 혼용하여 최소 6자 이상 입력해야 합니다!");
            return;
        }
    }
    if (isSignUp && (!name || !phone)) {
        showAuthError("회원가입 시 이름과 전화번호는 필수 기입사항입니다!");
        return;
    }
    
    if (supabaseClient) {
        if (isSignUp) {
            try {
                const { data, error } = await timeoutPromise(2500, supabaseClient.auth.signUp({
                    email: email,
                    password: password
                }));
                if (error) throw error;
                
                if (data.user) {
                    // 🛡️ [보안 고도화] 회원 프로필 생성 시 이름과 연락처를 AES로 암호화하여 DB에 전송합니다.
                    const { error: profileError } = await timeoutPromise(2500, supabaseClient
                        .from("profiles")
                        .insert([{
                            id: data.user.id,
                            name: secureEncrypt(name),
                            phone: secureEncrypt(phone),
                            postcode: "",
                            address: "",
                            address_detail: "",
                            points: 3000
                        }]));
                    if (profileError) throw profileError;
                }
                
                alert("🎉 회원가입이 정상 완료되었습니다!\n이메일 로그인 상태가 즉시 수립됩니다. 웰컴 3,000점 적립금이 자동 충전되었습니다.");
                closeAuthModal();
            } catch (e) {
                showAuthError(`회원가입 중 오류가 발생했습니다: ${e.message}`);
            }
        } else {
            try {
                const { error } = await timeoutPromise(2500, supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                }));
                if (error) throw error;
                
                alert("🔓 안전한 보안 로그인이 성공적으로 완료되었습니다!");
                closeAuthModal();
                navigateTo('home');
            } catch (e) {
                showAuthError(`로그인 실패: 이메일 또는 비밀번호를 다시 확인하세요!`);
            }
        }
    } else {
        if (isSignUp) {
            const mockUserId = `mock-user-${Math.floor(Math.random() * 100000)}`;
            const mockUserObj = { id: mockUserId, email: email };
            const mockProfileObj = { id: mockUserId, name: name, phone: phone, postcode: "", address: "", address_detail: "", points: 3000 };
            
            safeLocalStorage.setItem("pkb71_mock_user", JSON.stringify(mockUserObj));
            safeLocalStorage.setItem("pkb71_mock_profile", JSON.stringify(mockProfileObj));
            
            currentUser = mockUserObj;
            userProfile = mockProfileObj;
            
            updateHeaderAuthUI();
            alert("🎁 [더미 가상 가입] 웰컴 3,000원 적립금이 동적 적재되었습니다!");
            closeAuthModal();
        } else {
            const mockUserObj = { id: "mock-user-123", email: email };
            const mockProfileObj = { id: "mock-user-123", name: "박지호", phone: "010-9988-7766", postcode: "06035", address: "서울 강남구 압구정로 201", address_detail: "현대아파트 80동 1102호", points: 3000 };
            
            safeLocalStorage.setItem("pkb71_mock_user", JSON.stringify(mockUserObj));
            safeLocalStorage.setItem("pkb71_mock_profile", JSON.stringify(mockProfileObj));
            
            currentUser = mockUserObj;
            userProfile = mockProfileObj;
            
            updateHeaderAuthUI();
            alert("🔓 [더미 가상 로그인] '박지호'님 로그인 연동되었습니다. (적립금 3,000점 활성화)");
            closeAuthModal();
            navigateTo('home');
        }
    }
}

// 🛡️ [UX 고도화] 팝업 경고창 대신 모달 내부에 인라인 텍스트 형식으로 깔끔하게 에러를 출력합니다.
function showAuthError(msg) {
    const inlineError = document.getElementById("auth-inline-error");
    if (inlineError) {
        inlineError.textContent = msg;
        inlineError.style.display = "block";
    } else {
        // 하위 호환용 Fallback
        const errorMsg = document.getElementById("auth-error-msg");
        if (errorMsg) {
            errorMsg.textContent = msg;
            errorMsg.style.display = "block";
        }
    }
}

async function handleLogout() {
    const isConfirmed = await showCustomConfirm("정말 로그아웃을 진행하시겠습니까?");
    if (!isConfirmed) return;
    
    // Q&A 비밀글 해독 성공 목록 세션스토리지 캐시 영구 삭제 (보안 강화)
    sessionStorage.removeItem("qna_unlocked_ids");
    
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    } else {
        safeLocalStorage.removeItem("pkb71_mock_user");
        safeLocalStorage.removeItem("pkb71_mock_profile");
        currentUser = null;
        userProfile = null;
        updateHeaderAuthUI();
    }
    
    alert("🔒 로그아웃 완료되었습니다!");
    navigateTo('home');
}

// =========================================================================
// 3. [🏠 회원 전용 마이페이지 & 배송 정보 프로필 연동 로직]
// =========================================================================
async function fetchUserProfile() {
    if (!currentUser) return;
    
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single());
                
            if (error) {
                if (error.code === "PGRST116") {
                    // 🛡️ [보안 고도화] 신규 회원 프로필 최초 생성 시 이메일 아이디(이름 대용)를 암호화하여 기록합니다.
                    const newProfile = {
                        id: currentUser.id,
                        name: secureEncrypt(currentUser.email.split('@')[0]),
                        phone: "",
                        postcode: "",
                        address: "",
                        address_detail: "",
                        points: 3000
                    };
                    await timeoutPromise(2500, supabaseClient.from("profiles").insert([newProfile]));
                    
                    // 메모리상의 전역 변수에는 화면 출력을 위해 평문(복호화 상태)으로 보관합니다.
                    userProfile = {
                        ...newProfile,
                        name: secureDecrypt(newProfile.name)
                    };
                } else {
                    throw error;
                }
            } else {
                // 🛡️ [보안 고도화] DB에서 가용 개인정보를 불러온 즉시 복호화하여 전역 메모리에 이식합니다.
                userProfile = {
                    ...data,
                    name: secureDecrypt(data.name),
                    phone: secureDecrypt(data.phone),
                    postcode: secureDecrypt(data.postcode),
                    address: secureDecrypt(data.address),
                    address_detail: secureDecrypt(data.address_detail)
                };
            }
        } catch (e) {
            console.warn("⏱️ 프로필 조회 지연 (로컬 캐시 전환):", e.message);
        }
    }
}

async function saveUserProfile() {
    const name = document.getElementById("my-name").value.trim();
    const phone = document.getElementById("my-phone").value.trim();
    const postcode = document.getElementById("my-postcode").value.trim();
    const address = document.getElementById("my-address").value.trim();
    const addressDetail = document.getElementById("my-address-detail").value.trim();
    
    if (!name || !phone || !postcode || !address || !addressDetail) {
        alert("기본 주소지 등록을 위해 필수 입력사항(*)을 모두 기재해 주세요! 🏠");
        return;
    }
    
    // 🛡️ [보안 고도화] 메모리 및 로컬 보존용 평문(복호화) 객체를 별도 분리하여 조립합니다.
    const plainProfile = {
        id: currentUser.id,
        name: name,
        phone: phone,
        postcode: postcode,
        address: address,
        address_detail: addressDetail,
        points: userProfile ? userProfile.points : 3000
    };
    
    // 🛡️ [보안 고도화] DB 업로드 및 클라우드 적재 전용 암호화된 객체를 조립합니다.
    const encryptedProfile = {
        id: currentUser.id,
        name: secureEncrypt(name),
        phone: secureEncrypt(phone),
        postcode: secureEncrypt(postcode),
        address: secureEncrypt(address),
        address_detail: secureEncrypt(addressDetail),
        points: userProfile ? userProfile.points : 3000
    };
    
    if (supabaseClient) {
        try {
            // DB에는 암호화된 프로필 정보를 전송합니다.
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("profiles")
                .upsert(encryptedProfile));
                
            if (error) throw error;
            userProfile = plainProfile; // 메모리에는 평문 값을 보관하여 UI 깨짐을 예방합니다.
            alert("💾 기본 배송 주소지가 클라우드 서버에 안전 저장 완료되었습니다!");
            updateHeaderAuthUI();
        } catch (e) {
            alert(`⚠️ 배송지 저장 중 오류가 발생했습니다: ${e.message}`);
        }
    } else {
        userProfile = plainProfile;
        // safeLocalStorage 래퍼가 내부적으로 이중 암호화를 진행하므로 평문 객체로 보관 기록합니다.
        safeLocalStorage.setItem("pkb71_mock_profile", JSON.stringify(plainProfile));
        alert("💾 [더미 모드] 로컬 저장소에 기본 배송지가 보존되었습니다!");
        updateHeaderAuthUI();
    }
}

async function fetchUserOrders() {
    const tbody = document.getElementById("mypage-order-rows");
    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 40px 0;">
                <div class="spinner" style="width:20px; height:20px;"></div>
                <p style="margin-top: 10px; font-size:11.5px; color:var(--text-secondary);">실시간 주문 장부를 인출해 오고 있습니다...</p>
            </td>
        </tr>
    `;
    
    let ordersList = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("orders")
                .select("*")
                .eq("user_id", currentUser.id)
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            ordersList = data || [];
        } catch (e) {
            console.warn("❌ 내 주문대장 조회 지연 (더미 내역 로드):", e.message);
            ordersList = DUMMY_ORDERS.filter(o => o.user_id === currentUser.id);
        }
    } else {
        ordersList = DUMMY_ORDERS.filter(o => o.user_id === currentUser.id);
    }
    
    renderMyOrdersTable(ordersList);
}

function renderMyOrdersTable(orders) {
    const tbody = document.getElementById("mypage-order-rows");
    tbody.innerHTML = "";
    
    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 50px 0;">
                    아직 주문 접수된 이력이 존재하지 않습니다. 🧥🛍️
                </td>
            </tr>
        `;
        return;
    }
    
    orders.forEach(o => {
        const tr = document.createElement("tr");
        const oDate = new Date(o.created_at);
        const formattedDate = `${oDate.getFullYear()}-${(oDate.getMonth()+1).toString().padStart(2,'0')}-${oDate.getDate().toString().padStart(2,'0')}`;
        
        let actionsHtml = "";
        
        if (o.status === "입금대기") {
            actionsHtml = `<button class="mypage-claim-btn" onclick="requestClaim('${o.id}', '${o.order_no}', '주문취소')">주문 취소</button>`;
        } else if (o.status === "결제완료") {
            actionsHtml = `
                <button class="mypage-claim-btn" onclick="requestClaim('${o.id}', '${o.order_no}', '반품신청')">반품 신청</button>
                <button class="mypage-claim-btn" style="border-color:#1565C0; color:#1565C0;" onclick="requestClaim('${o.id}', '${o.order_no}', '교환신청')">교환 신청</button>
            `;
        } else if (o.status === "배송중") {
            const deliveryMsg = o.message && o.message.includes("[송장:") 
                ? `<span style="font-size:10px; color:var(--accent-gold); display:block; margin-top:2px;">🚛 ${o.message.match(/\[송장:[^\]]+\]/)[0]}</span>`
                : "";
                
            actionsHtml = `
                <span class="status-badge shipping">배송중</span>
                ${deliveryMsg}
                <button class="mypage-write-review-btn" onclick="openReviewWriteFlow('${o.id}', '${o.order_no}', '${o.items[0]?.prodId || 'dummy-1'}', '${o.items[0]?.name || '의류'}')">후기 작성</button>
            `;
        } else {
            actionsHtml = `<span class="status-badge">${o.status}</span>`;
        }
        
        const itemsHtml = o.items.map(item => {
            return `
                <div style="font-size:11.5px; line-height:1.4; margin-bottom:5px;">
                    • <b>${item.name}</b> (${item.color} / ${item.size} - ${item.qty}개)
                </div>
            `;
        }).join("");
        
        tr.innerHTML = `
            <td>
                <span style="font-family:var(--font-outfit); font-weight:700; color:var(--text-primary);">${o.order_no}</span><br>
                <span style="font-size:10.5px; color:var(--text-secondary);">${formattedDate}</span>
            </td>
            <td>${itemsHtml}</td>
            <td style="font-family:var(--font-outfit); font-weight:700;">
                ₩${o.total_amount.toLocaleString()}
            </td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-start;">
                    ${actionsHtml}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

