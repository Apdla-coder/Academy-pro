// ============================================================================
// SUBSCRIPTIONS TAB - All subscription management functions
// ============================================================================

async function loadSubscriptionsTab() {
  try {
    console.log('📋 Loading subscriptions tab...');
    
    const container = document.getElementById('subscriptionsContainer');
    if (!container) {
      console.error('❌ Container not found!');
      return;
    }
    
    container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <p>جاري تحميل بيانات الاشتراكات...</p>
      </div>
    `;
    
    console.log('🔄 Loading data...');
    // Force refresh all related data
    await Promise.all([
      loadSubscriptions(true),
      loadStudents(true),
      loadCourses(true),
      loadPayments(true)
    ]);
    
    console.log('✅ Data loaded - Subscriptions:', window.subscriptions?.length);
    
    if (window.subscriptions && window.subscriptions.length > 0) {
      console.log('🎨 Rendering subscriptions...');
      renderSubscriptionsTable(window.subscriptions, container);
    } else {
      console.log('⚠️ No subscriptions found');
      container.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: #999;">
          <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
          <h3 style="margin: 0 0 10px 0; color: #666;">لا توجد اشتراكات</h3>
          <p style="margin: 0 0 20px 0; color: #999; font-size: 0.9em;">ابدأ بإضافة اشتراك جديد</p>
          <button class="btn btn-primary" onclick="showAddSubscriptionModal()">
            <i class="fas fa-plus"></i> إضافة اشتراك
          </button>
        </div>
      `;
    }
    
    console.log('✅ Subscriptions tab loaded successfully');
  } catch (error) {
    console.error('❌ Error loading subscriptions tab:', error);
    const container = document.getElementById('subscriptionsContainer');
    if (container) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: #ef4444;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px;"></i>
          <p>خطأ في تحميل البيانات</p>
          <p style="font-size: 0.9rem; color: #999;">${error.message}</p>
          <button class="btn btn-primary" onclick="loadSubscriptionsTab()" style="margin-top: 15px;">
            <i class="fas fa-sync-alt"></i> إعادة المحاولة
          </button>
        </div>
      `;
    }
  }
}

function renderSubscriptionsTable(data, container) {
  console.log('🎨 renderSubscriptionsTable called with', data?.length, 'records');

  if (!container) {
    console.error('❌ Container not found in renderSubscriptionsTable');
    return;
  }

  // build header actions and search area using classes so CSS can handle layout
  let html = `
    <div class="table-container">
      <div class="table-actions-row">
        <button class="btn btn-primary" onclick="showAddSubscriptionModal()">
          <i class="fas fa-plus"></i> إضافة اشتراك جديد
        </button>
        <button class="btn btn-success" onclick="exportSubscriptionsExcel()">
          <i class="fas fa-file-excel"></i> تحميل البيانات
        </button>
        <button class="btn btn-info" onclick="printSubscriptions()">
          <i class="fas fa-print"></i> طباعة
        </button>
      </div>

      <div class="search-filter">
        <div class="search-box">
          <input type="text" id="subscriptionSearch" placeholder="ابحث عن طالب أو كورس..." onkeyup="filterSubscriptions()">
        </div>
        <select id="subscriptionStatusFilter" onchange="filterSubscriptions()">
          <option value="all">جميع الحالات</option>
          <option value="active">نشط فقط</option>
          <option value="inactive">منتهي فقط</option>
        </select>
      </div>`;

  if (!data || data.length === 0) {
    html += `
      <div style="padding: 60px 20px; text-align: center; color: #999;">
        <i class="fas fa-inbox" style="font-size: 4rem; margin-bottom: 20px; display: block; opacity: 0.5;"></i>
        <h3 style="margin: 0 0 10px 0; color: #666;">لا توجد اشتراكات</h3>
        <p style="margin: 0 0 20px 0; color: #999; font-size: 0.9em;">ابدأ بإضافة اشتراك جديد</p>
        <button class="btn btn-primary" onclick="showAddSubscriptionModal()">
          <i class="fas fa-plus"></i> إضافة اشتراك
        </button>
      </div>
    `;
  } else {
    const activeCount = data.filter(s => s.status === 'active').length;
    const inactiveCount = data.length - activeCount;

    html += `
      <div class="summary-cards">
        <div class="summary-card" style="background: #3B82F6; color: white;">
          <p style="opacity: 0.95;">إجمالي الاشتراكات</p>
          <div class="value">${data.length}</div>
        </div>
        <div class="summary-card" style="background: #10B981; color: white;">
          <p style="opacity: 0.95;">✓ الاشتراكات النشطة</p>
          <div class="value">${activeCount}</div>
        </div>
        <div class="summary-card" style="background: #EF4444; color: white;">
          <p style="opacity: 0.95;">✗ المنتهية</p>
          <div class="value">${inactiveCount}</div>
        </div>
      </div>

      <div class="table-responsive">
        <table style="background: var(--bg-card); border: 1px solid rgba(148, 163, 184, 0.1);">
          <thead>
            <tr style="background: #3B82F6;">
              <th style="color: white; border: none;">👤 الطالب</th>
              <th style="color: white; border: none;">📖 الكورس</th>
              <th style="color: white; border: none;">💰 السعر</th>
              <th style="color: white; border: none;">📅 التاريخ</th>
              <th style="color: white; border: none;">الحالة</th>
              <th style="color: white; border: none;">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((sub, idx) => `
              <tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.1); background: var(--bg-card);">
                <td data-label="الطالب" style="color: #F1F5F9;">${escapeHtml(sub.student_name || '-')}</td>
                <td data-label="الكورس" style="color: #CBD5E1;">${escapeHtml(sub.course_name || '-')}</td>
                <td data-label="السعر" style="color: #3B82F6; font-weight: 600;">${formatCurrency(sub.course_price || 0)}</td>
                <td data-label="التاريخ" style="color: #CBD5E1;">${formatDate(sub.subscribed_at)}</td>
                <td data-label="الحالة"><span class="status-badge ${sub.status === 'active' ? 'active' : 'inactive'}">${sub.status === 'active' ? '✓ نشط' : '✗ منتهي'}</span></td>
                <td data-label="الإجراءات">
                  <button class="action-btn view-btn" onclick="showSubscriptionDetails('${sub.id}')" style="background: #8B5CF6; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-left: 4px; font-weight: 600;">📋</button>
                  <button class="action-btn edit-btn" onclick="editSubscription('${sub.id}')" style="background: #F59E0B; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; margin-left: 4px; font-weight: 600;">✏️</button>
                  <button class="action-btn delete-btn" onclick="deleteSubscription('${sub.id}')" style="background: #EF4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-weight: 600;">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
  console.log('✅ Subscriptions table rendered successfully');
}

function filterSubscriptions() {
  const searchTerm = document.getElementById('subscriptionSearch')?.value || '';
  const statusFilter = document.getElementById('subscriptionStatusFilter')?.value || 'all';
  const container = document.getElementById('subscriptionsContainer');
  if (!container) return;

  let filtered = (window.subscriptions || []).filter(sub => {
    const matchSearch = !searchTerm || 
      sub.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.course_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchSearch && matchStatus;
  });

  renderSubscriptionsTable(filtered, container);
}

function showSubscriptionDetails(subscriptionId) {
  try {
    console.log('📋 Showing subscription details for:', subscriptionId);
    const subscription = (window.subscriptions || []).find(s => s.id === subscriptionId);
    if (!subscription) {
      showStatus('لم يتم العثور على الاشتراك', 'error');
      return;
    }

    const detailsHTML = `
      <div class="subscription-details-modal">
        <div class="details-header" style="background: #3B82F6; color: white; padding: 24px; border-radius: 8px 8px 0 0; margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 1.6em; font-weight: 700;">تفاصيل الاشتراك</h2>
          <p style="margin: 10px 0 0 0; font-size: 1em; opacity: 0.95;">معلومات الاشتراك الكاملة</p>
        </div>

        <div style="padding: 25px; background: var(--bg-card);">
          <div class="details-section">
            <h3 style="color: #3B82F6; border-bottom: 2px solid #3B82F6; padding-bottom: 12px; margin-bottom: 18px; font-size: 1.3em; font-weight: 700;">📚 معلومات الاشتراك</h3>
            <div class="details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px;">
              <div>
                <label style="color: #CBD5E1; font-size: 1em; display: block; margin-bottom: 8px; font-weight: 500;">👤 اسم الطالب:</label>
                <p style="margin: 0; font-weight: 600; font-size: 1.1em; color: #F1F5F9;">${escapeHtml(subscription.student_name || '-')}</p>
              </div>
              <div>
                <label style="color: #CBD5E1; font-size: 1em; display: block; margin-bottom: 8px; font-weight: 500;">📖 اسم الكورس:</label>
                <p style="margin: 0; font-weight: 600; font-size: 1.1em; color: #F1F5F9;">${escapeHtml(subscription.course_name || '-')}</p>
              </div>
            </div>
          </div>

          <div class="details-section" style="margin-top: 25px;">
            <h3 style="color: #3B82F6; border-bottom: 2px solid #3B82F6; padding-bottom: 12px; margin-bottom: 18px; font-size: 1.3em; font-weight: 700;">📅 تاريخ والسعر</h3>
            <div class="details-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; margin-top: 18px;">
              <div style="background: rgba(59, 130, 246, 0.1); padding: 18px; border-radius: 8px; text-align: center; border: 1px solid rgba(59, 130, 246, 0.2);">
                <p style="margin: 0; color: #3B82F6; font-size: 0.9em; font-weight: 600;">📆 تاريخ الاشتراك</p>
                <p style="margin: 10px 0 0 0; font-weight: 700; color: #1E3A8A; font-size: 1.1em;">${formatDate(subscription.subscribed_at)}</p>
              </div>
              <div style="background: rgba(16, 185, 129, 0.1); padding: 18px; border-radius: 8px; text-align: center; border: 1px solid rgba(16, 185, 129, 0.2);">
                <p style="margin: 0; color: #10B981; font-size: 0.9em; font-weight: 600;">💰 سعر الكورس</p>
                <p style="margin: 10px 0 0 0; font-weight: 700; color: #059669; font-size: 1.1em;">${formatCurrency(subscription.course_price || 0)}</p>
              </div>
            </div>
          </div>

          <div class="details-section" style="margin-top: 25px;">
            <h3 style="color: #3B82F6; border-bottom: 2px solid #3B82F6; padding-bottom: 12px; margin-bottom: 18px; font-size: 1.3em; font-weight: 700;">⚙️ حالة الاشتراك</h3>
            <div style="margin-top: 18px;">
              <span style="display: inline-block; padding: 12px 20px; border-radius: 20px; font-weight: 600; font-size: 1.05em; ${
                subscription.status === 'active' 
                  ? 'background: rgba(16, 185, 129, 0.2); color: #10B981; border: 2px solid #10B981;' 
                  : 'background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 2px solid #EF4444;'
              }">
                ${subscription.status === 'active' ? '✓ نشط' : '✗ منتهي'}
              </span>
            </div>
          </div>

          <div class="details-section" style="margin-top: 25px; padding: 16px; background: var(--bg-secondary); border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.1);">
            <p style="margin: 0; color: #CBD5E1; font-size: 0.9em;">
              <strong style="color: #F1F5F9;">معرف الاشتراك:</strong> <span style="color: #CBD5E1;">${subscription.id}</span>
            </p>
            <p style="margin: 10px 0 0 0; color: #CBD5E1; font-size: 0.9em;">
              <strong style="color: #F1F5F9;">تاريخ الإنشاء:</strong> <span style="color: #CBD5E1;">${formatDate(subscription.created_at)}</span>
            </p>
          </div>
        </div>

        <div style="padding: 20px; background: var(--bg-secondary); border-radius: 0 0 8px 8px; display: flex; gap: 12px; justify-content: flex-end; border-top: 1px solid rgba(148, 163, 184, 0.1);">
          <button onclick="closeSubscriptionDetails()" class="btn btn-secondary" style="padding: 12px 20px; font-size: 1em; font-weight: 600;">إغلاق</button>
          <button onclick="closeSubscriptionDetails(); editSubscription('${subscription.id}')" class="btn btn-primary" style="padding: 12px 20px; font-size: 1em; font-weight: 600;">تعديل</button>
        </div>
      </div>
    `;

    let detailsModal = document.getElementById('subscriptionDetailsModal');
    if (!detailsModal) {
      detailsModal = document.createElement('div');
      detailsModal.id = 'subscriptionDetailsModal';
      detailsModal.className = 'modal';
      detailsModal.style.cssText = 'display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; align-items: center; justify-content: center; background: rgba(0,0,0,0.5); z-index: 1000;';
      document.body.appendChild(detailsModal);
    }

    detailsModal.innerHTML = `
      <div class="modal-content" style="width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto; background: var(--bg-card); border-radius: 12px; box-shadow: var(--shadow-lg), 0 0 30px rgba(59, 130, 246, 0.2); border: 1px solid rgba(148, 163, 184, 0.1);">
        ${detailsHTML}
      </div>
    `;
    detailsModal.style.display = 'flex';

    detailsModal.onclick = (e) => {
      if (e.target === detailsModal) closeSubscriptionDetails();
    };

  } catch (error) {
    console.error('❌ Error showing subscription details:', error);
    showStatus('خطأ في عرض التفاصيل', 'error');
  }
}

function closeSubscriptionDetails() {
  const modal = document.getElementById('subscriptionDetailsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function exportSubscriptionsExcel() {
  try {
    const data = (window.subscriptions || []).map((s, idx) => ({
      '#': idx + 1,
      'اسم الطالب': s.student_name || '-',
      'اسم الكورس': s.course_name || '-',
      'سعر الكورس': formatCurrency(s.course_price || 0),
      'تاريخ الاشتراك': formatDate(s.subscribed_at),
      'الحالة': s.status === 'active' ? '✓ نشط' : '✗ منتهي'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws.A1.s = { font: { bold: true }, fill: { fgColor: { rgb: "FFD700" } } };
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الاشتراكات');
    XLSX.writeFile(wb, `الاشتراكات_${new Date().toLocaleDateString('ar-EG')}.xlsx`);
    
    showStatus('✅ تم تصدير البيانات بنجاح', 'success');
  } catch (error) {
    console.error('❌ Error exporting subscriptions:', error);
    showStatus('خطأ في التصدير', 'error');
  }
}

function printSubscriptions() {
  try {
    const table = document.querySelector('#subscriptionsContainer table');
    
    if (!table) {
      showStatus('لا توجد بيانات للطباعة', 'error');
      return;
    }

    const printWindow = window.open('', '', 'height=600,width=1000');
    printWindow.document.write(`
      <html>
        <head>
          <title>تقرير الاشتراكات</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Arial', sans-serif; 
              direction: rtl; 
              padding: 20px;
              background: #f5f5f5;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 3px solid #333;
              padding-bottom: 10px;
            }
            .header h2 {
              margin: 0;
              color: #333;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #666;
              font-size: 0.9em;
            }
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin-top: 20px;
              background: white;
            }
            th, td { 
              border: 1px solid #ddd; 
              padding: 12px; 
              text-align: right; 
            }
            th { 
              background-color: #667eea; 
              color: white;
              font-weight: bold;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            tr:hover {
              background-color: #f0f0f0;
            }
            .footer {
              margin-top: 20px;
              text-align: center;
              color: #666;
              font-size: 0.85em;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>تقرير الاشتراكات</h2>
            <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          ${table.outerHTML}
          <div class="footer">
            <p>تم إنشاء هذا التقرير من نظام إدارة الأكاديمية</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  } catch (error) {
    console.error('❌ Error printing subscriptions:', error);
    showStatus('خطأ في الطباعة', 'error');
  }
}