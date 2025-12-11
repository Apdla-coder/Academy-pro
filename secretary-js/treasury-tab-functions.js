// ============================================================================
// TREASURY TAB - Treasury management and transactions
// ============================================================================

let treasuryData = null;
let treasuryTransactions = [];

/**
 * Load treasury data
 */
async function loadTreasuryTab() {
  try {
    console.log('💰 Loading treasury tab...');
    
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    if (!academyId) {
      console.error('❌ Academy ID not set');
      return;
    }

    // Load treasury balance - use limit(1) to handle duplicate entries
    // Force fresh load by not using cache for treasury data
    const { data: treasuryList, error: treasuryError } = await window.supabaseClient
      .from('treasury')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(1);

    // Get first treasury if exists
    const treasury = treasuryList && treasuryList.length > 0 ? treasuryList[0] : null;
    
    console.log('📊 Treasury data loaded:', treasury);

    if (treasuryError) {
      console.error('❌ Treasury error:', treasuryError);
      // Don't show error if it's just "not found"
      if (treasuryError.code !== 'PGRST116') {
        showStatus('خطأ في تحميل بيانات الخزينة', 'error');
      }
    }

    // If treasury doesn't exist, create it
    if (!treasury || treasuryError?.code === 'PGRST116') {
      console.log('🔄 Treasury not found, creating new one...');
      const { data: newTreasury, error: createError } = await window.supabaseClient
        .from('treasury')
        .insert([{
          academy_id: academyId,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0
        }])
        .select()
        .maybeSingle();

      if (createError) {
        console.error('❌ Create treasury error:', createError);
        // If creation fails due to RLS, try to use trigger or show helpful message
        if (createError.code === '42501') {
          showStatus('⚠️ لا توجد صلاحيات لإنشاء الخزينة. يرجى تطبيق ملف SQL أولاً', 'warning');
          // Set default empty treasury data
          treasuryData = {
            id: null,
            academy_id: academyId,
            balance: 0,
            total_deposited: 0,
            total_withdrawn: 0
          };
        } else {
          showStatus('خطأ في إنشاء الخزينة: ' + createError.message, 'error');
          return;
        }
      } else if (newTreasury) {
        treasuryData = newTreasury;
        console.log('✅ New treasury created:', treasuryData);
      } else {
        // Fallback: set empty data
        treasuryData = {
          id: null,
          academy_id: academyId,
          balance: 0,
          total_deposited: 0,
          total_withdrawn: 0
        };
      }
    } else {
      treasuryData = treasury;
      console.log('✅ Treasury data updated:', treasuryData);
    }

    // Update UI
    updateTreasuryBalance();

    // Load transactions
    await loadTreasuryTransactions();

    // تحديث البادج
    updateTreasuryWithdrawalBadge();
    
    // استعادة حالة الإخفاء من localStorage
    const isTreasuryTableHidden = localStorage.getItem('treasuryTransactionsVisible') === 'false';
    const treasuryContent = document.getElementById('treasuryContent');
    const toggleBtn = document.getElementById('toggleTreasuryTableBtn');
    
    if (treasuryContent && toggleBtn) {
      if (isTreasuryTableHidden) {
        treasuryContent.classList.add('treasury-transactions-hidden');
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i> <span>إظهار السجل</span>';
      } else {
        treasuryContent.classList.remove('treasury-transactions-hidden');
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> <span>إخفاء السجل</span>';
      }
    }
  } catch (error) {
    console.error('❌ Error loading treasury:', error);
    showStatus('خطأ في تحميل بيانات الخزينة', 'error');
  }
}

/**
 * Update treasury balance display
 */
function updateTreasuryBalance() {
  if (!treasuryData) return;

  const balanceEl = document.getElementById('treasuryBalance');
  const depositedEl = document.getElementById('treasuryTotalDeposited');
  const withdrawnEl = document.getElementById('treasuryTotalWithdrawn');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(treasuryData.balance || 0);
  }
  if (depositedEl) {
    depositedEl.textContent = formatCurrency(treasuryData.total_deposited || 0);
  }
  if (withdrawnEl) {
    withdrawnEl.textContent = formatCurrency(treasuryData.total_withdrawn || 0);
  }
}

/**
 * Load treasury transactions
 */
async function loadTreasuryTransactions() {
  try {
    const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
    if (!academyId) return;

    const container = document.getElementById('treasuryTransactionsContainer');
    if (!container) return;

    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>جاري تحميل سجل المعاملات...</p></div>';

    // Force fresh load without cache
    const { data: transactions, error } = await window.supabaseClient
      .from('treasury_transactions')
      .select('*')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    treasuryTransactions = transactions || [];
    console.log('📊 Transactions loaded:', treasuryTransactions.length, 'transactions');
    treasuryTransactions.forEach(t => {
      console.log(`   - ${t.transaction_type}: ${t.amount} ج.م - ${t.description}`);
    });
    
    // تحديث عدد السحوبات في البادج
    updateTreasuryWithdrawalBadge();
    
    renderTreasuryTransactions();
    
    // Set up real-time listener for treasury_transactions
    setupTreasuryRealtimeListener(academyId);
  } catch (error) {
    console.error('❌ Error loading transactions:', error);
    const container = document.getElementById('treasuryTransactionsContainer');
    if (container) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger); padding: 20px;">خطأ في تحميل سجل المعاملات: ${error.message}</p>`;
    }
  }
}

/**
 * Set up real-time listener for treasury transactions
 */
function setupTreasuryRealtimeListener(academyId) {
  try {
    if (!window.supabaseClient) return;
    
    // Subscribe to treasury_transactions changes using the new Supabase realtime API
    const subscription = window.supabaseClient
      .channel(`public:treasury_transactions`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'treasury_transactions',
          filter: `academy_id=eq.${academyId}`
        }, 
        (payload) => {
          console.log('🔄 Treasury transaction updated in real-time:', payload);
          
          // Reload treasury data to get updated balance
          if (treasuryData) {
            loadTreasuryTab();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time listener for treasury subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Error subscribing to treasury real-time updates');
        }
      });
    
    // Store subscription reference to clean up later if needed
    window.treasuryRealtimeSubscription = subscription;
  } catch (error) {
    console.error('❌ Error setting up real-time listener:', error);
  }
}

/**
 * Render treasury transactions
 */
function renderTreasuryTransactions(filter = '') {
  const container = document.getElementById('treasuryTransactionsContainer');
  if (!container) return;

  let filteredTransactions = treasuryTransactions;

  if (filter) {
    filteredTransactions = treasuryTransactions.filter(t => t.transaction_type === filter);
  }

  if (filteredTransactions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
        <p>لا توجد معاملات</p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="attendance-table" style="min-width: 600px;">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>النوع</th>
            <th>المبلغ</th>
            <th>الوصف</th>
            <th>المسؤول</th>
          </tr>
        </thead>
        <tbody>
  `;

  filteredTransactions.forEach(transaction => {
    const date = new Date(transaction.created_at).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const typeClass = transaction.transaction_type === 'deposit' ? 'success' : 'danger';
    const typeIcon = transaction.transaction_type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up';
    const typeText = transaction.transaction_type === 'deposit' ? 'إيداع' : 'سحب';

    html += `
      <tr>
        <td data-label="التاريخ">${date}</td>
        <td data-label="النوع">
          <span class="status-badge ${typeClass}">
            <i class="fas ${typeIcon}"></i> ${typeText}
          </span>
        </td>
        <td data-label="المبلغ" style="font-weight: 700; color: ${transaction.transaction_type === 'deposit' ? 'var(--success)' : 'var(--danger)'};">
          ${transaction.transaction_type === 'deposit' ? '+' : '-'}${formatCurrency(transaction.amount)}
        </td>
        <td data-label="الوصف">${transaction.description || '-'}</td>
        <td data-label="المسؤول">${transaction.created_by ? 'المدير' : 'نظام'}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  
  // تحديث البادج عند عرض المعاملات
  updateTreasuryWithdrawalBadge();
}

/**
 * Filter treasury transactions
 */
function filterTreasuryTransactions() {
  const filter = document.getElementById('treasuryFilter')?.value || '';
  renderTreasuryTransactions(filter);
}

/**
 * Export treasury to Excel
 */
async function exportTreasuryExcel() {
  try {
    if (!window.XLSX) {
      showStatus('مكتبة Excel غير محملة', 'error');
      return;
    }

    const data = treasuryTransactions.map(t => ({
      'التاريخ': new Date(t.created_at).toLocaleDateString('ar-EG'),
      'النوع': t.transaction_type === 'deposit' ? 'إيداع' : 'سحب',
      'المبلغ': t.amount,
      'الوصف': t.description || '',
      'المسؤول': t.created_by ? 'المدير' : 'نظام'
    }));

    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'سجل المعاملات');

    const fileName = `خزينة_${new Date().toISOString().split('T')[0]}.xlsx`;
    window.XLSX.writeFile(wb, fileName);

    showStatus('✅ تم تصدير البيانات بنجاح', 'success');
  } catch (error) {
    console.error('❌ Export error:', error);
    showStatus('خطأ في تصدير البيانات', 'error');
  }
}

// Register the treasury refresh callback with the TabRefreshManager
if (window.tabRefreshManager) {
  window.tabRefreshManager.onRefresh('treasury', async function() {
    await loadTreasuryTab();
  });
}

// Auto-load when tab is switched - use event-based approach
if (!window._switchTabHandlers) {
  window._switchTabHandlers = [];
}

window._switchTabHandlers.push(function(tabName) {
  if (tabName === 'treasury') {
    loadTreasuryTab();
  }
});

// Debug function to check treasury status
window.debugTreasury = async function() {
  const academyId = window.currentAcademyId || window.ACADEMY_ID || localStorage.getItem('current_academy_id');
  if (!academyId) {
    console.error('❌ No academy ID');
    return;
  }

  console.log('🔍 === TREASURY DEBUG ===');
  console.log('Academy ID:', academyId);

  // Check treasury
  const { data: treasury } = await window.supabaseClient
    .from('treasury')
    .select('*')
    .eq('academy_id', academyId);
  console.log('💰 Treasury:', treasury);

  // Check treasury transactions
  const { data: transactions } = await window.supabaseClient
    .from('treasury_transactions')
    .select('*')
    .eq('academy_id', academyId);
  console.log('📋 Transactions:', transactions);

  // Check payments with 'paid' status
  const { data: payments } = await window.supabaseClient
    .from('payments')
    .select('*')
    .eq('academy_id', academyId)
    .eq('status', 'paid');
  console.log('💳 Paid payments:', payments?.length, payments);

  console.log('🔍 === END DEBUG ===');
};

/**
 * تحديث عدد السحوبات في البادج بجانب تاب الخزينة
 */
function updateTreasuryWithdrawalBadge() {
  try {
    const badge = document.getElementById('treasuryWithdrawalCount');
    if (!badge || !treasuryTransactions) return;
    
    // عد السحوبات (withdrawal)
    const withdrawalCount = treasuryTransactions.filter(t => t.transaction_type === 'withdrawal').length;
    
    // تحديث البادج برقم السحوبات
    badge.textContent = withdrawalCount;
    
    // تغيير اللون حسب عدد السحوبات
    if (withdrawalCount > 10) {
      badge.style.background = '#ef4444'; // أحمر فاقع للعدد الكبير
      badge.style.fontWeight = 'bold';
    } else if (withdrawalCount > 5) {
      badge.style.background = '#f97316'; // برتقالي للعدد المتوسط
      badge.style.fontWeight = '600';
    } else if (withdrawalCount > 0) {
      badge.style.background = '#10b981'; // أخضر للعدد الصغير
      badge.style.fontWeight = '500';
    } else {
      badge.style.background = '#6b7280'; // رمادي عندما لا توجد سحوبات
    }
    
    console.log(`📊 Treasury badge updated: ${withdrawalCount} withdrawals`);
  } catch (error) {
    console.error('❌ Error updating treasury badge:', error);
  }
}

/**
 * تبديل ظهور وإخفاء جدول المعاملات
 */
function toggleTreasuryTransactionsTable() {
  try {
    const treasuryContent = document.getElementById('treasuryContent');
    const btn = document.getElementById('toggleTreasuryTableBtn');
    
    if (!treasuryContent || !btn) {
      console.error('❌ Elements not found');
      return;
    }
    
    const isHidden = treasuryContent.classList.toggle('treasury-transactions-hidden');
    
    // تحديث نص الزر والأيقونة
    if (isHidden) {
      btn.innerHTML = '<i class="fas fa-eye"></i> <span>إظهار السجل</span>';
    } else {
      btn.innerHTML = '<i class="fas fa-eye-slash"></i> <span>إخفاء السجل</span>';
    }
    
    // حفظ الحالة في localStorage
    localStorage.setItem('treasuryTransactionsVisible', !isHidden);
    
    console.log(`👁️ Treasury transactions table ${isHidden ? 'hidden' : 'shown'}`);
  } catch (error) {
    console.error('❌ Error toggling treasury transactions table:', error);
  }
}


