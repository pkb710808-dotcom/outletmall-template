// 🛡️ [보안 고도화] Q&A 및 리뷰 도배 작성을 물리적으로 차단하기 위한 통신 락 플래그
let isQnaSubmitting = false;
let isReviewSubmitting = false;

// =========================================================================
// 7. [⭐ 포토/텍스트 리뷰(Review) 등록 및 상품 상세 연동 로직]
// =========================================================================
async function fetchReviews(prodId) {
    let reviewsList = [];
    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("reviews")
                .select("*")
                .eq("prod_id", prodId)
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            reviewsList = data || [];
        } catch(e) {
            reviewsList = [];
        }
    }
    
    const matchedLocal = localReviews.filter(r => r.prod_id === prodId);
    reviewsList = [...matchedLocal, ...reviewsList];
    
    if (reviewsList.length === 0) {
        reviewsList = DUMMY_REVIEWS.filter(r => r.prod_id === prodId);
    }
    
    renderProductReviews(reviewsList);
}

function renderProductReviews(reviews) {
    const listContainer = document.getElementById("det-reviews-list-container");
    const countSpan = document.getElementById("det-review-count");
    const avgStars = document.getElementById("det-avg-stars");
    const avgNum = document.getElementById("det-avg-num");
    
    // 🛡️ [Fail-safe 방어막] 엘리먼트 존재 여부를 철저하게 검사하여 에러 발생 원천 차단
    if (countSpan) countSpan.textContent = reviews.length;
    
    if (reviews.length === 0) {
        if (avgStars) avgStars.textContent = "☆☆☆☆☆";
        if (avgNum) avgNum.textContent = "0.0 / 5.0";
        if (listContainer) listContainer.innerHTML = `<p style="text-align: center; padding: 20px 0; color: var(--text-secondary); font-size:12.5px;">아직 이 상품에 등록된 구매 만족 후기가 없습니다.</p>`;
        return;
    }
    
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    const avg = (sum / reviews.length).toFixed(1);
    
    let starStr = "";
    const rounded = Math.round(avg);
    for (let i = 1; i <= 5; i++) {
        starStr += (i <= rounded) ? "★" : "☆";
    }
    
    if (avgStars) avgStars.textContent = starStr;
    if (avgNum) avgNum.textContent = `${avg} / 5.0`;
    
    if (listContainer) {
        listContainer.innerHTML = "";
        reviews.forEach(r => {
            const card = document.createElement("div");
            card.className = "review-card";
            
            let stars = "";
            for (let i = 1; i <= 5; i++) {
                stars += (i <= r.rating) ? "★" : "☆";
            }
            
            const photoHtml = r.image_url 
                ? `<img src="${r.image_url}" class="review-photo-img" onclick="window.open('${r.image_url}')">`
                : "";
                
            const dateStr = new Date(r.created_at).toISOString().split('T')[0];
            
            const replyHtml = r.reply 
                ? `<div class="qna-reply-box" style="margin-top:12px;">
                       <span class="qna-reply-title">대표님 감사 답변</span>
                       <p class="qna-reply-content" style="margin-top:5px; font-size:12px;">${escapeHtml(r.reply)}</p>
                   </div>`
                : "";
                
            card.innerHTML = `
                <div class="review-card-header">
                    <span class="review-author-info">${escapeHtml(r.author)}님</span>
                    <span class="review-date-info">${dateStr}</span>
                </div>
                <span class="review-stars">${stars}</span>
                <p class="review-body-text">${escapeHtml(r.content)}</p>
                ${photoHtml}
                ${replyHtml}
            `;
            listContainer.appendChild(card);
        });
    }
}

function openReviewWriteFlow(orderId, orderNo, prodId, prodName) {
    const modal = document.getElementById("review-modal");
    const container = document.getElementById("review-modal-form-content");
    
    container.innerHTML = `
        <p style="font-size:12.5px; color:var(--text-secondary); margin-bottom:15px;">구매 상품: <b>${prodName}</b> (${orderNo})</p>
        <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">별점 만족도 <span class="required">*</span></label>
            <select id="rev-rating" class="form-input" style="padding:8px; font-size:13px; font-weight:700;">
                <option value="5">★★★★★ 아주 만족해요 (5점)</option>
                <option value="4">★★★★☆ 마음에 들어요 (4점)</option>
                <option value="3">★★★☆☆ 보통이에요 (3점)</option>
                <option value="2">★★☆☆☆ 조금 아쉬워요 (2점)</option>
                <option value="1">★☆☆☆☆ 기대 이하에요 (1점)</option>
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">피팅 컷 사진 URL 링크 (선택)</label>
            <input type="text" id="rev-image-url" placeholder="착용 이미지가 있다면 웹 주소를 기재해 주세요." class="form-input">
        </div>
        <div class="form-group" style="margin-bottom: 20px;">
            <label class="form-label">상세 구매 후기 한줄평 <span class="required">*</span></label>
            <textarea id="rev-content" rows="4" placeholder="소재의 느낌, 사이즈 선택의 조언을 생생하게 남겨 주세요. 겉옷 핏감 등을 공유하면 큰 도움이 됩니다. 겉옷을 입고 어울리는 코디 방법도 좋습니다! 🧥✨" class="form-input qna-textarea"></textarea>
        </div>
        <button class="order-submit-btn" onclick="submitReviewAction('${orderId}', '${orderNo}', '${prodId}')">
            ⭐ 소중한 착용 후기 제출하기
        </button>
    `;
    
    modal.style.display = "flex";
}

function closeReviewModal() {
    document.getElementById("review-modal").style.display = "none";
}

function closeReviewModalOutside(event) {
    if (event.target.id === "review-modal") {
        closeReviewModal();
    }
}

async function submitReviewAction(orderId, orderNo, prodId) {
    if (isReviewSubmitting) {
        console.warn("⚠️ 리뷰 등록 요청이 이미 처리 중입니다. 중복 클릭 차단.");
        return;
    }
    
    const rating = parseInt(document.getElementById("rev-rating").value);
    const image_url = document.getElementById("rev-image-url").value.trim();
    const content = document.getElementById("rev-content").value.trim();
    const author = userProfile?.name || currentUser?.email.split('@')[0] || "회원";
    
    if (!content) {
        alert("구매 후기 내용을 입력해 주세요! 🧥");
        return;
    }
    
    // 락 획득
    isReviewSubmitting = true;
    
    const reviewData = {
        prod_id: prodId,
        user_id: currentUser.id,
        order_no: orderNo,
        author: author,
        rating: rating,
        content: content,
        image_url: image_url || null,
        created_at: new Date().toISOString()
    };
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("reviews")
                .insert([reviewData]));
                
            if (error) throw error;
            alert("⭐️ 후기가 안전하게 저장되었습니다. 감사합니다! 🫡✨");
            closeReviewModal();
            fetchUserOrders();
        } catch(e) {
            alert(`⚠️ DB 리뷰 저장 오류: ${e.message}`);
        } finally {
            isReviewSubmitting = false; // 락 해제
        }
    } else {
        const copyRev = { ...reviewData, id: `rev-${Math.floor(Math.random()*100000)}` };
        localReviews.unshift(copyRev);
        safeLocalStorage.setItem("pkb71_reviews", JSON.stringify(localReviews));
        
        alert("⭐️ [더미 모드] 가상 후기가 등록 보존되었습니다!");
        closeReviewModal();
        fetchUserOrders();
        isReviewSubmitting = false; // 락 해제
    }
}

// =========================================================================
// 💬 [Q&A 간편 게시판 & 1:1 비밀 글 열람 컴포넌트]
// =========================================================================

// Supabase 실시간 문의 대장 또는 더미 데이터 인출
async function fetchQnaPosts() {
    const tbody = document.getElementById("qna-rows-container");
    if (tbody) {
        tbody.innerHTML = `
            <tr class="skeleton-row">
                <td><div class="skeleton-block" style="width: 60px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-title" style="height: 18px;"></div></td>
                <td><div class="skeleton-block" style="width: 50px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-meta" style="height: 18px;"></div></td>
            </tr>
            <tr class="skeleton-row">
                <td><div class="skeleton-block" style="width: 60px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-title" style="width: 85%; height: 18px;"></div></td>
                <td><div class="skeleton-block" style="width: 50px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-meta" style="width: 35%; height: 18px;"></div></td>
            </tr>
            <tr class="skeleton-row">
                <td><div class="skeleton-block" style="width: 60px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-title" style="width: 60%; height: 18px;"></div></td>
                <td><div class="skeleton-block" style="width: 50px; height: 18px;"></div></td>
                <td><div class="skeleton-block skeleton-meta" style="width: 45%; height: 18px;"></div></td>
            </tr>
        `;
    }

    if (supabaseClient) {
        try {
            const { data, error } = await timeoutPromise(2500, supabaseClient
                .from("qna")
                .select("*")
                .order("created_at", { ascending: false }));
                
            if (error) throw error;
            qnaPosts = data || [];
        } catch(e) {
            qnaPosts = [...DUMMY_QNA];
        }
    } else {
        qnaPosts = [...DUMMY_QNA];
    }
    renderQnaRows();
}

// 질문 게시판 표 리스팅 및 비밀글 클릭 대응 바인딩
function renderQnaRows() {
    const tbody = document.getElementById("qna-rows-container");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    if (qnaPosts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 30px 0; font-size:12px;">
                    등록된 Q&A 문의 내역이 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    qnaPosts.forEach(q => {
        const tr = document.createElement("tr");
        const date = new Date(q.created_at).toISOString().split('T')[0];
        const lockIcon = q.is_secret ? "🔒 비밀글" : "🔓 공개글";
        const statusText = q.reply ? `<span class="qna-status active">답변완료</span>` : `<span class="qna-status">답변대기</span>`;
        
        tr.className = "qna-row-tr";
        tr.innerHTML = `
            <td>${statusText}</td>
            <td style="text-align: left; padding-left: 20px; cursor: pointer;" onclick="handleQnaClick('${q.id}')">
                <span style="color:var(--text-secondary); font-size:10.5px; margin-right:6px;">${lockIcon}</span>
                <span style="font-size:12.5px; font-weight:600;">${escapeHtml(q.title)}</span>
            </td>
            <td style="font-size:12px;">${escapeHtml(q.author)}</td>
            <td style="font-family:var(--font-outfit); font-size:11px; color:var(--text-secondary);">${date}</td>
        `;
        
        // 본문 슬라이드 내용 상자 이식 (디폴트 숨김)
        const detailTr = document.createElement("tr");
        detailTr.id = `qna-detail-${q.id}`;
        detailTr.style.display = "none";
        detailTr.style.backgroundColor = "#F9F8F6";
        
        const replyContent = q.reply 
            ? `<div class="qna-reply-box" style="margin-top:15px; border-top:1px dashed #ddd; padding-top:12px;">
                   <span class="qna-reply-title" style="font-size:11px; font-weight:700; color:var(--accent-gold); display:block; margin-bottom:5px;">💬 대표님 감사 답변 피드백</span>
                   <p class="qna-reply-content" style="margin:0; font-size:12px; line-height:1.5; color:var(--text-primary);">${escapeHtml(q.reply)}</p>
               </div>` 
            : "";
            
        // 🔒 [보안 강화] 비밀글인 경우 본문 내용을 페이지 소스 보기나 HTML 검사로 보지 못하도록 사전에 마스킹 처리합니다.
        // 나중에 사용자가 올바른 비밀번호를 입력해 복호화에 성공했을 때만 동적으로 이 텍스트를 한글로 원복합니다.
        const isEncrypted = q.is_secret && q.content && q.content.startsWith("U2FsdGVkX1");
        const displayText = isEncrypted 
            ? "[🔒 본 문의사항은 비밀번호 암호화 처리가 되어 있습니다. 클릭하여 비밀번호를 입력해야 해독됩니다.]" 
            : `Q. ${escapeHtml(q.content)}`;
            
        detailTr.innerHTML = `
            <td colspan="4" style="text-align: left; padding: 20px 30px; line-height:1.6; font-size:12.5px; border-bottom:1px solid #eee;">
                <div class="qna-content-box" style="color:var(--text-primary); display:flex; justify-content:space-between; align-items:flex-start; gap:20px;">
                    <p style="margin:0; font-weight:500; flex:1;" id="qna-content-text-${q.id}">${displayText}</p>
                    <!-- 🛡️ [보안/편의 고도화] 질문글 수정/삭제 버튼 제어 존 -->
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        <button class="mypage-claim-btn" style="margin: 0; padding: 3px 8px; font-size: 11px;" onclick="editQnaPost('${q.id}')">✏️ 수정</button>
                        <button class="mypage-claim-btn" style="margin: 0; padding: 3px 8px; font-size: 11px; border-color: #D32F2F; color: #D32F2F;" onclick="deleteQnaPostDirect('${q.id}')">🗑️ 삭제</button>
                    </div>
                </div>
                ${replyContent}
            </td>
        `;
        
        tbody.appendChild(tr);
        tbody.appendChild(detailTr);
    });
}

// Q&A 특정 비밀글을 클릭했을 때의 패스워드 인증 게이트
// [보안 강화] 비밀번호는 SHA-256 해시 대조를 통해 검증하며, 본문은 대칭키(AES) 복호화를 동적으로 실행합니다.
// Q&A 특정 비밀글을 클릭했을 때의 패스워드 인증 게이트
// [보안 강화] 비밀번호는 SHA-256 해시 대조를 통해 검증하며, 본문은 대칭키(AES) 복호화를 동적으로 실행합니다.
// [UX 고도화] 1회 올바른 비밀번호로 복호화에 성공했거나 작성자/대표님 본인인 경우, 브라우저 세션에 저장하여 재클릭 시 prompt 입력을 생략합니다.
function handleQnaClick(id) {
    const q = qnaPosts.find(item => item.id === id);
    if (!q) return;
    
    const detailTr = document.getElementById(`qna-detail-${id}`);
    if (!detailTr) return;
    
    if (q.is_secret) {
        const isAuth = sessionStorage.getItem("admin_authenticated") === "true";
        const isAuthor = currentUser && (q.user_id === currentUser.id);
        
        // 브라우저 세션에 보관된 잠금 해제 성공 Q&A ID 목록 호출
        let unlockedIds = [];
        try {
            unlockedIds = JSON.parse(sessionStorage.getItem("qna_unlocked_ids") || "[]");
        } catch(e) {
            unlockedIds = [];
        }
        const isUnlocked = unlockedIds.includes(id);
        
        const contentEl = document.getElementById(`qna-content-text-${id}`);
        const isEncrypted = q.content && q.content.startsWith("U2FsdGVkX1");
        const isAlreadyDecrypted = contentEl && !contentEl.textContent.includes("[🔒 본 문의사항은 비밀번호");
        
        // 🛡️ [보안/편의 고도화] 대표님이거나, 작성자 본인이거나, 이미 세션 내에서 인증을 한 번 통과한 글이면 패스워드 입력 없이 자동 복호화 노출
        if (isAuth || isAuthor || isUnlocked) {
            if (isEncrypted && !isAlreadyDecrypted) {
                const decryptedText = secureDecrypt(q.content);
                if (contentEl) contentEl.textContent = `Q. ${decryptedText}`;
            }
            detailTr.style.display = (detailTr.style.display === "none") ? "table-row" : "none";
            return;
        }
        
        // 일반 방문객이라면 최초 1회 개별 작성 비밀번호를 요구합니다.
        const pw = prompt("🔒 본 문의사항은 작성자 및 대표님만 보실 수 있는 비밀글입니다.\n설정하신 4자리 비밀번호를 입력해 주세요:");
        if (!pw) return;
        
        if (isEncrypted) {
            // 1) 입력한 패스워드의 SHA-256 해시 생성
            const inputHash = CryptoJS.SHA256(pw).toString();
            
            // 2) 해시 일치 여부 비교
            if (inputHash === q.password) {
                // 3) 마스터 키를 이용해 안전하게 실시간 복호화 수행
                const decryptedText = secureDecrypt(q.content);
                if (contentEl) contentEl.textContent = `Q. ${decryptedText}`;
                
                // 4) 성공 시 세션스토리지에 이식하여 재클릭 시 prompt 생략
                if (!unlockedIds.includes(id)) {
                    unlockedIds.push(id);
                    sessionStorage.setItem("qna_unlocked_ids", JSON.stringify(unlockedIds));
                }
                
                detailTr.style.display = (detailTr.style.display === "none") ? "table-row" : "none";
            } else {
                alert("❌ 비밀번호가 일치하지 않습니다!");
            }
        } else {
            // 💡 [과거 데이터 호환성 가드] 암호화되지 않은 기존 평문 비밀글인 경우
            if (pw === q.password) {
                if (!unlockedIds.includes(id)) {
                    unlockedIds.push(id);
                    sessionStorage.setItem("qna_unlocked_ids", JSON.stringify(unlockedIds));
                }
                detailTr.style.display = (detailTr.style.display === "none") ? "table-row" : "none";
            } else {
                alert("❌ 비밀번호가 일치하지 않습니다!");
            }
        }
    } else {
        detailTr.style.display = (detailTr.style.display === "none") ? "table-row" : "none";
    }
}

// ✏️ Q&A 문의 작성 모달창 개설
function openQnaWriteModal() {
    const modal = document.getElementById("qna-modal");
    if (!modal) return;
    
    // 폼 초기 세팅 (공개글/비밀글에 상관없이 본인인증을 위해 비밀번호 입력을 항상 받아야 하므로, display를 block으로 설정합니다)
    document.getElementById("qna-title-input").value = "";
    document.getElementById("qna-content-input").value = "";
    document.getElementById("qna-secret-checkbox").checked = false;
    document.getElementById("qna-password-input").value = "";
    document.getElementById("qna-password-group").style.display = "block"; // 항상 노출되도록 block으로 변경
    
    // 작성자 닉네임 입력칸이 존재하면 현재 로그인된 회원명으로 자동 기입
    const authorInput = document.getElementById("qna-author-input");
    if (authorInput) {
        authorInput.value = userProfile?.name || currentUser?.email.split('@')[0] || "";
    }
    
    modal.style.display = "flex";
}

// Q&A 작성창 닫기
function closeQnaModal() {
    document.getElementById("qna-modal").style.display = "none";
}

// Q&A 모달 외부 클릭 닫기
function closeQnaModalOutside(event) {
    if (event.target.id === "qna-modal") {
        closeQnaModal();
    }
}

// 비밀글 설정 스위치 클릭 시 비밀번호 입력칸 표출 여부 제어
// 비밀글 설정 스위치 클릭 시 비밀번호 입력칸 표출 여부 제어
// [보안/편의 고도화] 수정/삭제 및 본인확인을 위해 모든 Q&A 글 비밀번호 설정이 필수이므로, 항상 노출(block)을 유지하도록 보완합니다.
function toggleQnaSecretForm() {
    document.getElementById("qna-password-group").style.display = "block";
}

// 작성 문의글 최종 접수 및 보관소에 기록
// [보안 고도화] 비밀글 등록 시 패스워드는 SHA-256 해싱 처리하며, 본문은 대칭키(AES) 암호화를 실시합니다.
async function submitQnaPost() {
    if (isQnaSubmitting) {
        console.warn("⚠️ Q&A 등록 요청이 이미 처리 중입니다. 중복 클릭 차단.");
        return;
    }
    
    const title = document.getElementById("qna-title-input").value.trim();
    const contentRaw = document.getElementById("qna-content-input").value.trim();
    const isSecret = document.getElementById("qna-secret-checkbox").checked;
    const passwordRaw = document.getElementById("qna-password-input").value.trim();
    
    // 작성자가 직접 입력한 닉네임을 사용하고, 빈칸인 경우에만 로그인 정보 또는 기본값 적용
    const authorInput = document.getElementById("qna-author-input");
    const author = (authorInput && authorInput.value.trim()) 
        ? authorInput.value.trim() 
        : (userProfile?.name || currentUser?.email.split('@')[0] || "고객님");
    
    if (!title || !contentRaw) {
        alert("문의 제목과 질문 상세 내용은 필수 입력 사항입니다! 🧥");
        return;
    }
    
    // 🛡️ [보안/편의 고도화] 수정/삭제 및 본인확인을 위해 모든 Q&A 글 비밀번호 설정 필수화
    if (!passwordRaw || passwordRaw.length !== 4 || isNaN(passwordRaw)) {
        alert("수정/삭제 및 본인확인을 위해 숫자 4자리 비밀번호를 정확히 채워주세요! 🔑");
        return;
    }
    
    // 락 획득
    isQnaSubmitting = true;
    
    let finalContent = contentRaw;
    // 🛡️ [보안/편의 고도화] 전체 비밀번호는 SHA-256 해시로 저장하여 본인 대조용으로 씁니다.
    let finalPassword = CryptoJS.SHA256(passwordRaw).toString();
    
    if (isSecret) {
        // 🛡️ [보안 고도화] 비밀글 본문을 대표님 공통 보안 마스터 키(LOCAL_STORAGE_SECRET)로 대칭 암호화합니다.
        // 이를 통해 대표님은 개별 비밀번호를 몰라도 어드민 세션 권한으로 바로 해독하여 읽으실 수 있습니다!
        finalContent = secureEncrypt(contentRaw);
    }
    
    const qnaData = {
        title: title,
        content: finalContent,
        is_secret: isSecret,
        password: finalPassword,
        author: author,
        user_id: currentUser ? currentUser.id : "guest-user",
        created_at: new Date().toISOString()
    };
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("qna")
                .insert([qnaData]));
                
            if (error) throw error;
            alert("🎉 질문이 공급처 실시간 게시판에 정상 기재되었습니다!");
            closeQnaModal();
            fetchQnaPosts();
        } catch(e) {
            alert(`⚠️ DB 질문 등록 오류: ${e.message}`);
        } finally {
            isQnaSubmitting = false; // 락 해제
        }
    } else {
        const copyQna = { ...qnaData, id: `qna-${Math.floor(Math.random()*100000)}` };
        DUMMY_QNA.unshift(copyQna);
        alert("🎁 [더미 모드] 문의글이 가상 보드판에 등록되었습니다!");
        closeQnaModal();
        fetchQnaPosts();
        isQnaSubmitting = false; // 락 해제
    }
}

function renderNoticePage() {
    const container = document.getElementById("notice-list-container");
    if (!container) return;
    container.innerHTML = "";
    
    // 분류에 맞춤 필터링
    const filtered = localNotices.filter(n => {
        if (currentNoticeFilter === "all") return true;
        return n.type === currentNoticeFilter;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:50px; color:var(--text-secondary); font-size:13px;">등록된 내역이 존재하지 않습니다.</p>`;
        return;
    }
    
    filtered.forEach(n => {
        const item = document.createElement("div");
        item.className = "notice-item";
        item.id = `notice-item-${n.id}`;
        
        const badgeText = n.type === "notice" ? "NOTICE" : "EVENT";
        const badgeClass = n.type === "notice" ? "notice" : "event";
        const dateStr = new Date(n.created_at).toLocaleDateString("ko-KR", { year: 'numeric', month: '2-digit', day: '2-digit' });
        
        item.innerHTML = `
            <div class="notice-summary" onclick="toggleNoticeAccordion('${n.id}')">
                <div class="notice-title-box">
                    <span class="notice-badge ${badgeClass}">${badgeText}</span>
                    <span class="notice-title-text">${n.title}</span>
                </div>
                <div class="notice-meta-right">
                    <span class="notice-date">${dateStr}</span>
                    <span class="notice-arrow">▼</span>
                </div>
            </div>
            <div class="notice-content">
                <div class="notice-body-inner">${n.content}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

function filterNoticeBoard(filter) {
    currentNoticeFilter = filter;
    
    // 탭 단추 활성화 스위칭
    document.getElementById("notice-tab-all").classList.remove("active");
    document.getElementById("notice-tab-notice").classList.remove("active");
    document.getElementById("notice-tab-event").classList.remove("active");
    
    const activeBtn = document.getElementById(`notice-tab-${filter}`);
    if (activeBtn) activeBtn.classList.add("active");
    
    renderNoticePage();
}

function toggleNoticeAccordion(id) {
    const item = document.getElementById(`notice-item-${id}`);
    if (!item) return;
    
    const isExpanded = item.classList.contains("expanded");
    
    // 아코디언 연출을 위해 다른 공지글은 닫음
    document.querySelectorAll(".notice-item").forEach(el => el.classList.remove("expanded"));
    
    if (!isExpanded) {
        item.classList.add("expanded");
    }
}

// 3. [리뷰 명예의 전당 격자 피드 렌더러]
function renderReviewFeedPage() {
    const container = document.getElementById("review-feed-container");
    if (!container) return;
    container.innerHTML = "";
    
    // 가상 로컬리뷰와 디폴트 리뷰 리스트 통합
    let allRev = [...localReviews, ...DUMMY_REVIEWS];
    
    // 🛡️ [보안/편의 고도화] 리뷰 평점 및 포토 필터링 분기 작동
    allRev = allRev.filter(r => {
        if (currentReviewFilter === "all") return true;
        if (currentReviewFilter === "5") return r.rating === 5;
        if (currentReviewFilter === "4") return r.rating === 4;
        if (currentReviewFilter === "3down") return r.rating <= 3;
        if (currentReviewFilter === "photo") return r.image_url !== null && r.image_url !== "";
        return true;
    });
    
    const countSpan = document.getElementById("review-stat-count");
    if (countSpan) countSpan.textContent = `${allRev.length}건`;
    
    if (allRev.length === 0) {
        container.innerHTML = `<p style="text-align:center; grid-column:1/-1; padding:50px; color:var(--text-secondary); font-size:13px;">VIP 고객 만족 리뷰가 아직 없습니다.</p>`;
        return;
    }
    
    allRev.forEach(r => {
        const card = document.createElement("div");
        card.className = "review-feed-card";
        
        // 클릭 시 해당 상세페이지로 바로 순간이동 처리
        card.onclick = () => {
            if (r.prod_id) {
                showProductDetail(r.prod_id);
            }
        };
        
        const starStr = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
        const dateStr = new Date(r.created_at).toLocaleDateString("ko-KR", { year: 'numeric', month: '2-digit', day: '2-digit' });
        
        // 매칭 상품 탐색
        const linkedProd = allProducts.find(p => p.id === r.prod_id);
        const prodName = linkedProd ? `🔗 [매칭명품] ${linkedProd.brand} ${linkedProd.name}` : "🔗 아울렛몰 직수입 명품 셀렉션";
        
        let imgTag = "";
        if (r.image_url) {
            imgTag = `
                <div class="review-card-img-box">
                    <img src="${r.image_url}" loading="lazy" alt="리뷰 실물 장착샷">
                </div>
            `;
        }
        
        const escapedAuthor = escapeHtml(r.author);
        const maskedAuthor = escapedAuthor.charAt(0) + "*" + (escapedAuthor.length > 1 ? escapedAuthor.charAt(escapedAuthor.length - 1) : "");

        card.innerHTML = `
            <div>
                <div class="review-card-header">
                    <span class="review-card-stars">${starStr}</span>
                    <span class="review-card-author">${maskedAuthor} VIP고객님</span>
                </div>
                <div class="review-card-product-link">${prodName}</div>
                ${imgTag}
                <p class="review-card-content">${escapeHtml(r.content)}</p>
            </div>
            <div class="review-card-footer">
                <span>💯 정품 품질 보증</span>
                <span>${dateStr}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// 🛡️ [보안/편의 고도화] 리뷰 피드 평점 및 포토후기 필터 상태 변수 & 필터 트리거
let currentReviewFilter = "all";

function filterReviewFeed(value) {
    currentReviewFilter = value;
    renderReviewFeedPage();
}

// 🛡️ [보안/편의 고도화] Q&A 본인글 수정 API
async function editQnaPost(id) {
    const q = qnaPosts.find(item => item.id === id);
    if (!q) return;
    
    // 대표님이거나 작성자 본인 인증 확인 (비밀번호 검증)
    const isAuth = sessionStorage.getItem("admin_authenticated") === "true";
    let pwConfirmed = false;
    let pw = "";
    
    if (isAuth) {
        pwConfirmed = true;
    } else {
        pw = prompt("🔑 글을 수정하려면 작성 시 입력했던 4자리 비밀번호를 적어주세요:");
        if (!pw) return;
        
        const inputHash = CryptoJS.SHA256(pw).toString();
        if (inputHash === q.password) {
            pwConfirmed = true;
        }
    }
    
    if (!pwConfirmed) {
        alert("❌ 비밀번호가 일치하지 않습니다!");
        return;
    }
    
    // 🛡️ [보안 고도화] 복잡한 이중 복호화를 제거하고, 마스터 키 헬퍼 함수로 본문을 안전하게 복원합니다.
    let originContent = q.content;
    const isEncrypted = q.content && q.content.startsWith("U2FsdGVkX1");
    if (isEncrypted) {
        originContent = secureDecrypt(q.content);
    }
    
    const newTitle = prompt("✏️ 수정할 질문 제목을 입력해 주세요:", q.title);
    if (newTitle === null) return;
    const newContent = prompt("✏️ 수정할 질문 상세 내용을 입력해 주세요:", originContent);
    if (newContent === null) return;
    
    if (!newTitle.trim() || !newContent.trim()) {
        alert("제목과 내용은 비워둘 수 없습니다!");
        return;
    }
    
    let finalContent = newContent;
    if (q.is_secret) {
        // 🛡️ [보안 고도화] 수정된 본문을 마스터 키로 안전하게 재암호화하여 저장합니다.
        finalContent = secureEncrypt(newContent);
    }
    
    const updatedData = {
        title: newTitle.trim(),
        content: finalContent
    };
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("qna")
                .update(updatedData)
                .eq("id", id));
            if (error) throw error;
            alert("✅ 문의글이 성공적으로 수정되었습니다.");
            fetchQnaPosts();
        } catch(e) {
            alert(`⚠️ DB 수정 실패: ${e.message}`);
        }
    } else {
        const idx = DUMMY_QNA.findIndex(item => item.id === id);
        if (idx !== -1) {
            DUMMY_QNA[idx].title = newTitle.trim();
            DUMMY_QNA[idx].content = finalContent;
        }
        alert("🎁 [더미 모드] 수정 완료!");
        fetchQnaPosts();
    }
}

// 🛡️ [보안/편의 고도화] Q&A 본인글 삭제 API
async function deleteQnaPostDirect(id) {
    const q = qnaPosts.find(item => item.id === id);
    if (!q) return;
    
    if (!confirm("🚨 정말로 이 Q&A 질문글을 영구 삭제하시겠습니까?")) return;
    
    const isAuth = sessionStorage.getItem("admin_authenticated") === "true";
    let pwConfirmed = false;
    
    if (isAuth) {
        pwConfirmed = true;
    } else {
        const pw = prompt("🔑 글을 삭제하려면 작성 시 설정한 4자리 비밀번호를 적어주세요:");
        if (!pw) return;
        
        const inputHash = CryptoJS.SHA256(pw).toString();
        if (inputHash === q.password) {
            pwConfirmed = true;
        }
    }
    
    if (!pwConfirmed) {
        alert("❌ 비밀번호가 일치하지 않아 삭제할 수 없습니다!");
        return;
    }
    
    if (supabaseClient) {
        try {
            const { error } = await timeoutPromise(2500, supabaseClient
                .from("qna")
                .delete()
                .eq("id", id));
            if (error) throw error;
            alert("🗑️ 질문글이 안전하게 영구 삭제되었습니다.");
            fetchQnaPosts();
        } catch(e) {
            alert(`⚠️ DB 삭제 실패: ${e.message}`);
        }
    } else {
        const idx = DUMMY_QNA.findIndex(item => item.id === id);
        if (idx !== -1) {
            DUMMY_QNA.splice(idx, 1);
        }
        alert("🗑️ [더미 모드] 삭제 완료!");
        fetchQnaPosts();
    }
}

// 4. [국내 전 택배사 스마트 원터치 배송추적 시스템]
