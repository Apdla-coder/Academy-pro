'use strict';

// ============================================================================
// COURSE MANAGEMENT - Complete course management with modules and lessons
// ============================================================================

let currentManagedCourseId = null;

// Open course management modal
async function openCourseManagement(courseId) {
  currentManagedCourseId = courseId;
  const course = window.courses?.find(c => c.id === courseId);
  
  if (!course) {
    showNotification('error', 'لم يتم العثور على الكورس');
    return;
  }

  const modal = document.getElementById('courseManagementModal');
  if (!modal) {
    showNotification('error', 'الموديل غير موجود');
    return;
  }

  // Load teachers for edit tab
  await loadTeachers();
  
  // Populate overview tab
  populateCourseOverview(course);
  
  // Populate edit tab
  populateCourseEdit(course);
  
  // Load modules and lessons
  await loadCourseModules(courseId);
  await loadCourseLessons(courseId);
  
  // Show modal and switch to overview tab
  modal.style.display = 'flex';
  switchCourseManagementTab('overview');
}

// Switch between tabs
function switchCourseManagementTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.course-tab-content').forEach(tab => {
    tab.style.display = 'none';
    tab.classList.remove('active');
  });
  
  // Remove active class from all buttons
  document.querySelectorAll('.course-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  const tabContent = document.getElementById(`course${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Tab`);
  const tabButton = document.querySelector(`.course-tab-btn[data-tab="${tabName}"]`);
  
  if (tabContent) {
    tabContent.style.display = 'block';
    tabContent.classList.add('active');
  }
  
  if (tabButton) {
    tabButton.classList.add('active');
  }
  
  // Load data when switching to modules/lessons tabs
  if (tabName === 'modules' && currentManagedCourseId) {
    loadCourseModules(currentManagedCourseId);
  } else if (tabName === 'lessons' && currentManagedCourseId) {
    loadCourseLessons(currentManagedCourseId);
  }
}

// Populate overview tab
function populateCourseOverview(course) {
  document.getElementById('detailCourseName').textContent = course.name || '-';
  document.getElementById('detailCourseDescription').textContent = course.description || 'لا يوجد وصف';
  document.getElementById('detailCoursePrice').textContent = formatCurrency(course.price || 0);
  
  const teacher = window.teachers?.find(t => t.id === course.teacher_id);
  document.getElementById('detailCourseTeacher').textContent = teacher?.full_name || 'لم يتم تعيين';
  
  document.getElementById('detailCourseStartDate').textContent = formatDate(course.start_date) || '-';
  document.getElementById('detailCourseEndDate').textContent = formatDate(course.end_date) || '-';
}

// Populate edit tab
function populateCourseEdit(course) {
  document.getElementById('editCourseId').value = course.id;
  document.getElementById('editCourseName').value = course.name || '';
  document.getElementById('editCourseDescription').value = course.description || '';
  document.getElementById('editCoursePrice').value = course.price || '';
  document.getElementById('editStartDate').value = course.start_date ? course.start_date.split('T')[0] : '';
  document.getElementById('editEndDate').value = course.end_date ? course.end_date.split('T')[0] : '';
  
  // Populate teachers dropdown
  const teacherSelect = document.getElementById('editTeacher');
  if (teacherSelect) {
    console.log('🔍 Populating teacher dropdown');
    console.log('📝 window.teachers available:', window.teachers?.length || 0);
    console.log('📝 window.teachers data:', window.teachers);
    
    teacherSelect.innerHTML = '<option value="">لم يتم تعيين معلم بعد</option>';
    if (window.teachers && window.teachers.length > 0) {
      window.teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.id;
        option.textContent = teacher.full_name || 'معلم بدون اسم';
        if (course.teacher_id === teacher.id) {
          option.selected = true;
        }
        teacherSelect.appendChild(option);
      });
      console.log('✅ Teacher dropdown populated with', window.teachers.length, 'teachers');
    } else {
      console.warn('⚠️ No teachers available to populate dropdown');
    }
  }
}

// Load course modules
async function loadCourseModules(courseId) {
  const container = document.getElementById('modulesListContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>جاري تحميل الوحدات...</p></div>';
    
    const { data, error } = await window.supabaseClient
      .from('modules')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="no-data">لا توجد وحدات</p>';
      return;
    }
    
    let html = '';
    data.forEach(module => {
      html += `
        <div class="module-item">
          <div>
            <h4>${escapeHtml(module.title || 'بدون عنوان')}</h4>
            <p>${escapeHtml(module.description || 'لا يوجد وصف')}</p>
            <p style="font-size: 0.8rem; color: #999;">تاريخ الإنشاء: ${formatDate(module.created_at) || '-'}</p>
          </div>
          <div class="module-actions">
            <button class="btn-edit" onclick="editModule('${module.id}')">
              <i class="fas fa-edit"></i> تعديل
            </button>
            <button class="btn-delete" onclick="deleteModule('${module.id}')">
              <i class="fas fa-trash"></i> حذف
            </button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('❌ Error loading modules:', error);
    container.innerHTML = '<p class="no-data" style="color: #f44336;">خطأ في تحميل الوحدات</p>';
  }
}

// Load course lessons
async function loadCourseLessons(courseId) {
  const container = document.getElementById('lessonsListContainer');
  if (!container) return;
  
  try {
    container.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>جاري تحميل الدروس...</p></div>';
    
    const { data, error } = await window.supabaseClient
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="no-data">لا توجد دروس</p>';
      return;
    }
    
    let html = '';
    data.forEach(lesson => {
      html += `
        <div class="lesson-item">
          <div>
            <h4>${escapeHtml(lesson.title || 'بدون عنوان')}</h4>
            <p>${escapeHtml(lesson.description || lesson.content || 'لا يوجد محتوى')}</p>
            <p style="font-size: 0.8rem; color: #999;">تاريخ الإنشاء: ${formatDate(lesson.created_at) || '-'}</p>
          </div>
          <div class="lesson-actions">
            <button class="btn-edit" onclick="editLesson('${lesson.id}')">
              <i class="fas fa-edit"></i> تعديل
            </button>
            <button class="btn-delete" onclick="deleteLesson('${lesson.id}')">
              <i class="fas fa-trash"></i> حذف
            </button>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('❌ Error loading lessons:', error);
    container.innerHTML = '<p class="no-data" style="color: #f44336;">خطأ في تحميل الدروس</p>';
  }
}

// Show add module modal
function showAddModuleModal() {
  if (!currentManagedCourseId) {
    showNotification('error', 'يرجى تحديد الكورس أولاً');
    return;
  }
  
  const modal = document.getElementById('moduleModal');
  if (!modal) return;
  
  document.getElementById('moduleId').value = '';
  document.getElementById('moduleCourseId').value = currentManagedCourseId;
  document.getElementById('moduleTitle').value = '';
  document.getElementById('moduleDescription').value = '';
  document.getElementById('moduleModalTitle').textContent = 'إضافة وحدة جديدة';
  
  modal.style.display = 'flex';
}

// Show add lesson modal
async function showAddLessonModal() {
  if (!currentManagedCourseId) {
    showNotification('error', 'يرجى تحديد الكورس أولاً');
    return;
  }
  
  const modal = document.getElementById('lessonModal');
  if (!modal) return;
  
  // Load modules for dropdown
  const { data: modules } = await window.supabaseClient
    .from('modules')
    .select('id, title')
    .eq('course_id', currentManagedCourseId)
    .order('created_at', { ascending: true });
  
  const moduleSelect = document.getElementById('lessonModuleSelect');
  if (moduleSelect) {
    moduleSelect.innerHTML = '<option value="">بدون وحدة</option>';
    if (modules && modules.length > 0) {
      modules.forEach(module => {
        const option = document.createElement('option');
        option.value = module.id;
        option.textContent = module.title;
        moduleSelect.appendChild(option);
      });
    }
  }
  
  document.getElementById('lessonId').value = '';
  document.getElementById('lessonCourseId').value = currentManagedCourseId;
  document.getElementById('lessonModuleId').value = '';
  document.getElementById('lessonTitle').value = '';
  document.getElementById('lessonContent').value = '';
  document.getElementById('lessonModalTitle').textContent = 'إضافة درس جديد';
  
  modal.style.display = 'flex';
}

// Edit module
async function editModule(moduleId) {
  try {
    const { data: module, error } = await window.supabaseClient
      .from('modules')
      .select('*')
      .eq('id', moduleId)
      .single();
    
    if (error) throw error;
    
    const modal = document.getElementById('moduleModal');
    if (!modal) return;
    
    document.getElementById('moduleId').value = module.id;
    document.getElementById('moduleCourseId').value = module.course_id;
    document.getElementById('moduleTitle').value = module.title || '';
    document.getElementById('moduleDescription').value = module.description || '';
    document.getElementById('moduleModalTitle').textContent = 'تعديل الوحدة';
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error('❌ Error loading module:', error);
    showNotification('error', 'خطأ في تحميل بيانات الوحدة');
  }
}

// Edit lesson
async function editLesson(lessonId) {
  try {
    const { data: lesson, error } = await window.supabaseClient
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();
    
    if (error) throw error;
    
    // Load modules for dropdown
    const { data: modules } = await window.supabaseClient
      .from('modules')
      .select('id, title')
      .eq('course_id', lesson.course_id)
      .order('created_at', { ascending: true });
    
    const moduleSelect = document.getElementById('lessonModuleSelect');
    if (moduleSelect) {
      moduleSelect.innerHTML = '<option value="">بدون وحدة</option>';
      if (modules && modules.length > 0) {
        modules.forEach(module => {
          const option = document.createElement('option');
          option.value = module.id;
          option.textContent = module.title;
          if (lesson.module_id === module.id) {
            option.selected = true;
          }
          moduleSelect.appendChild(option);
        });
      }
    }
    
    const modal = document.getElementById('lessonModal');
    if (!modal) return;
    
    document.getElementById('lessonId').value = lesson.id;
    document.getElementById('lessonCourseId').value = lesson.course_id;
    document.getElementById('lessonModuleId').value = lesson.module_id || '';
    document.getElementById('lessonTitle').value = lesson.title || '';
    document.getElementById('lessonContent').value = lesson.description || lesson.content || '';
    document.getElementById('lessonModalTitle').textContent = 'تعديل الدرس';
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error('❌ Error loading lesson:', error);
    showNotification('error', 'خطأ في تحميل بيانات الدرس');
  }
}

// Delete module
async function deleteModule(moduleId) {
  if (!confirm('هل تريد حذف هذه الوحدة؟')) return;
  
  try {
    const { error } = await window.supabaseClient
      .from('modules')
      .delete()
      .eq('id', moduleId);
    
    if (error) throw error;
    
    showNotification('success', 'تم حذف الوحدة بنجاح');
    await loadCourseModules(currentManagedCourseId);
  } catch (error) {
    console.error('❌ Error deleting module:', error);
    showNotification('error', 'خطأ في حذف الوحدة');
  }
}

// Delete lesson
async function deleteLesson(lessonId) {
  if (!confirm('هل تريد حذف هذا الدرس؟')) return;
  
  try {
    const { error } = await window.supabaseClient
      .from('lessons')
      .delete()
      .eq('id', lessonId);
    
    if (error) throw error;
    
    showNotification('success', 'تم حذف الدرس بنجاح');
    await loadCourseLessons(currentManagedCourseId);
  } catch (error) {
    console.error('❌ Error deleting lesson:', error);
    showNotification('error', 'خطأ في حذف الدرس');
  }
}

// Delete course from modal
async function deleteCourseFromModal() {
  if (!currentManagedCourseId) return;
  await deleteCourse(currentManagedCourseId);
  closeModal('courseManagementModal');
}

// Setup form event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Course edit form
  const courseEditForm = document.getElementById('courseEditForm');
  if (courseEditForm) {
    courseEditForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const courseId = document.getElementById('editCourseId').value;
      if (courseId) {
        await updateCourseFromModal(courseId);
      }
    });
  }
  
  // Module form
  const moduleForm = document.getElementById('moduleForm');
  if (moduleForm) {
    moduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveModule();
    });
  }
  
  // Lesson form
  const lessonForm = document.getElementById('lessonForm');
  if (lessonForm) {
    lessonForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveLesson();
    });
  }
});

// Update course from modal
async function updateCourseFromModal(courseId) {
  try {
    const name = document.getElementById('editCourseName').value;
    const description = document.getElementById('editCourseDescription').value;
    const price = document.getElementById('editCoursePrice').value;
    const teacherId = document.getElementById('editTeacher').value || null;
    const startDate = document.getElementById('editStartDate').value || null;
    const endDate = document.getElementById('editEndDate').value || null;
    
    if (!name || !price) {
      showNotification('error', 'الرجاء ملء الحقول المطلوبة');
      return;
    }
    
    const { error } = await window.supabaseClient
      .from('courses')
      .update({
        name: name,
        description: description,
        price: parseFloat(price),
        teacher_id: teacherId,
        start_date: startDate,
        end_date: endDate
      })
      .eq('id', courseId);
    
    if (error) throw error;
    
    showNotification('success', 'تم تحديث الكورس بنجاح');
    
    // Refresh course data
    clearDataCache('courses');
    await loadCourses(true);
    
    // Update current course object
    const course = window.courses?.find(c => c.id === courseId);
    if (course) {
      populateCourseOverview(course);
      populateCourseEdit(course);
    }
    
    // Switch to overview tab
    switchCourseManagementTab('overview');
  } catch (error) {
    console.error('❌ Error updating course:', error);
    showNotification('error', 'خطأ في تحديث الكورس');
  }
}

// Save module
async function saveModule() {
  try {
    const moduleId = document.getElementById('moduleId').value;
    const courseId = document.getElementById('moduleCourseId').value;
    const title = document.getElementById('moduleTitle').value;
    const description = document.getElementById('moduleDescription').value;
    
    if (!title) {
      showNotification('error', 'الرجاء إدخال اسم الوحدة');
      return;
    }
    
    if (!courseId) {
      showNotification('error', 'خطأ: معرف الكورس غير موجود');
      return;
    }
    
    if (moduleId) {
      // Update existing module
      const { error } = await window.supabaseClient
        .from('modules')
        .update({
          title: title,
          description: description
        })
        .eq('id', moduleId);
      
      if (error) throw error;
      showNotification('success', 'تم تحديث الوحدة بنجاح');
    } else {
      // Insert new module
      const { error } = await window.supabaseClient
        .from('modules')
        .insert([{
          course_id: courseId,
          title: title,
          description: description,
          academy_id: window.currentAcademyId
        }]);
      
      if (error) throw error;
      showNotification('success', 'تم إضافة الوحدة بنجاح');
    }
    
    closeModal('moduleModal');
    await loadCourseModules(courseId);
  } catch (error) {
    console.error('❌ Error saving module:', error);
    showNotification('error', 'خطأ في حفظ الوحدة');
  }
}

// Save lesson
async function saveLesson() {
  try {
    const lessonId = document.getElementById('lessonId').value;
    const courseId = document.getElementById('lessonCourseId').value;
    const moduleId = document.getElementById('lessonModuleSelect').value || null;
    const title = document.getElementById('lessonTitle').value;
    const content = document.getElementById('lessonContent').value;
    
    if (!title) {
      showNotification('error', 'الرجاء إدخال عنوان الدرس');
      return;
    }
    
    if (!courseId) {
      showNotification('error', 'خطأ: معرف الكورس غير موجود');
      return;
    }
    
    if (lessonId) {
      // Update existing lesson
      const { error } = await window.supabaseClient
        .from('lessons')
        .update({
          title: title,
          description: content,
          module_id: moduleId
        })
        .eq('id', lessonId);
      
      if (error) throw error;
      showNotification('success', 'تم تحديث الدرس بنجاح');
    } else {
      // Insert new lesson
      const { error } = await window.supabaseClient
        .from('lessons')
        .insert([{
          course_id: courseId,
          module_id: moduleId,
          title: title,
          description: content,
          academy_id: window.currentAcademyId
        }]);
      
      if (error) throw error;
      showNotification('success', 'تم إضافة الدرس بنجاح');
    }
    
    closeModal('lessonModal');
    await loadCourseLessons(courseId);
  } catch (error) {
    console.error('❌ Error saving lesson:', error);
    showNotification('error', 'خطأ في حفظ الدرس');
  }
}

// Make functions globally available
window.openCourseManagement = openCourseManagement;
window.switchCourseManagementTab = switchCourseManagementTab;
window.showAddModuleModal = showAddModuleModal;
window.showAddLessonModal = showAddLessonModal;
window.editModule = editModule;
window.editLesson = editLesson;
window.deleteModule = deleteModule;
window.deleteLesson = deleteLesson;
window.deleteCourseFromModal = deleteCourseFromModal;

