# 📐 Architecture Diagrams - Mobile Tab System

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   ADMIN DASHBOARD v2.0               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ HTML Structure                               │  │
│  ├──────────────────────────────────────────────┤  │
│  │ <div class="container">                      │  │
│  │   <div id="overviewTab" class="tab-content"> │  │
│  │     [Content]                                │  │
│  │   </div>                                     │  │
│  │ </div>                                       │  │
│  │                                              │  │
│  │ <nav class="tab-navigation">                 │  │
│  │   <button onclick="switchTab('overviewTab')">│  │
│  │   ...                                        │  │
│  │ </nav>                                       │  │
│  └──────────────────────────────────────────────┘  │
│                        ↓                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ CSS Styling                                  │  │
│  ├──────────────────────────────────────────────┤  │
│  │ .tab-content { display: none; }              │  │
│  │ .tab-content.active { display: block; }      │  │
│  │                                              │  │
│  │ @media (max-width: 768px) {                  │  │
│  │   .tab-navigation { display: flex; }         │  │
│  │ }                                            │  │
│  └──────────────────────────────────────────────┘  │
│                        ↓                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ JavaScript Logic                             │  │
│  ├──────────────────────────────────────────────┤  │
│  │ switchTab(tabName) {                         │  │
│  │   // Remove 'active' from all               │  │
│  │   // Add 'active' to selected               │  │
│  │   // Save to localStorage                   │  │
│  │ }                                            │  │
│  └──────────────────────────────────────────────┘  │
│                        ↓                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ User Interaction (Mobile)                    │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Tap Tab Button → switchTab() → Update DOM    │  │
│  │    → Save to localStorage → Show New Tab    │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
┌──────────────┐
│   User Tap   │
│  Tab Button  │
└──────┬───────┘
       │
       ↓
┌──────────────────────────┐
│   switchTab() Called     │
│  with 'tabName' param    │
└──────┬───────────────────┘
       │
       ├─→ Query DOM for all .tab-content
       │   └─→ Remove 'active' class
       │
       ├─→ Query DOM for selected tab
       │   └─→ Add 'active' class
       │       └─→ CSS: display: block
       │
       ├─→ Query all .tab-btn buttons
       │   └─→ Remove 'active' class
       │
       ├─→ Query active button
       │   └─→ Add 'active' class
       │
       ├─→ Save to localStorage
       │   └─→ activeTab = tabName
       │
       └─→ Scroll to top
           └─→ window.scrollTo(0, 0)
```

---

## State Management

```
┌─────────────────────────────────────────┐
│         LOCAL STORAGE STATE             │
├─────────────────────────────────────────┤
│                                         │
│  Key: 'activeTab'                       │
│  Value: 'overviewTab' | 'usersTab'      │
│         'treasuryTab' | 'reportsTab'    │
│         'settingsTab'                   │
│                                         │
│  Persisted: Across page refreshes       │
│  Scope: Domain-specific                 │
│  Size: ~20 bytes                        │
│                                         │
└─────────────────────────────────────────┘
         ↑                      ↓
    On Page Load           On Tab Switch
    └─ Read value      └─ Write new value
       └─ Restore      └─ Save preference
          active tab
```

---

## Component Hierarchy

```
DOCUMENT
│
├── <header class="header">
│   ├── <h1>لوحة تحكم المدير</h1>
│   └── <button class="logout-btn">خروج</button>
│
├── <div class="container">
│   │
│   ├── <div id="overviewTab" class="tab-content active">
│   │   ├── Error message container
│   │   ├── Stats grid
│   │   ├── Financial summary
│   │   ├── Users management
│   │   ├── Profile section
│   │   ├── Reports section
│   │   ├── Activity log section
│   │   ├── Messages section
│   │   └── Settings section
│   │
│   ├── (Future tabs would go here)
│   │
│   └── <nav class="tab-navigation">
│       ├── <button class="tab-btn active">الرئيسية</button>
│       ├── <button class="tab-btn">المستخدمين</button>
│       ├── <button class="tab-btn">الخزينة</button>
│       ├── <button class="tab-btn">التقارير</button>
│       └── <button class="tab-btn">الإعدادات</button>
│
└── <script>
    ├── switchTab() function
    ├── DOMContentLoaded initialization
    └── Other dashboard functions
```

---

## Responsive Behavior

```
┌─────────────────────────────────────────┐
│         VIEWPORT WIDTH                  │
├─────────────────────────────────────────┤
│                                         │
│  > 768px (Desktop)                      │
│  ├─ Tab Nav: HIDDEN (display: none)     │
│  ├─ Container padding: Normal           │
│  ├─ Content layout: Full-width          │
│  └─ Scroll: All content visible         │
│                                         │
│  ≤ 768px (Mobile/Tablet)                │
│  ├─ Tab Nav: VISIBLE (display: flex)    │
│  ├─ Container padding: +70px bottom     │
│  ├─ Content layout: One tab at a time   │
│  └─ Scroll: Per-tab basis               │
│                                         │
└─────────────────────────────────────────┘

 Breakpoint: 768px
 └─→ Created by: @media (max-width: 768px)
 └─→ Triggered by: Browser width check
 └─→ Result: Dynamic layout change
```

---

## Tab Switching Flow

```
User Opens Dashboard
│
├─ DOMContentLoaded fires
│  └─ Read localStorage.activeTab
│     └─ Default: 'overviewTab'
│        └─ Call switchTab(activeTab)
│           └─ Show that tab
│
│
User Taps Tab Button
│
├─ Click event triggers
│  └─ switchTab(tabName) called
│     │
│     ├─ Remove .active from ALL tabs
│     │  └─ CSS: display: none
│     │
│     ├─ Add .active to SELECTED tab
│     │  └─ CSS: display: block
│     │
│     ├─ Remove .active from ALL buttons
│     │
│     ├─ Add .active to clicked button
│     │  └─ CSS: white + darker bg
│     │
│     ├─ Save to localStorage
│     │  └─ activeTab = newTabName
│     │
│     └─ Scroll to top
│        └─ window.scrollTo(0, 0)
│
│
New Tab Displayed
└─ User can scroll/interact with content
```

---

## CSS Cascade for Active States

```
Normal Button
├─ color: rgba(255, 255, 255, 0.6)    [60% opacity white]
├─ background: none                    [transparent]
└─ transition: all 0.3s ease
   └─ On hover: background 10% opacity

Active Button (.active)
├─ color: white                        [100% opacity white]
├─ background: rgba(0, 0, 0, 0.2)     [20% opacity black]
└─ font-weight: 500                    [semi-bold]

Active Tab Content (.tab-content.active)
├─ display: block                      [visible]
└─ (Other tabs have display: none)
```

---

## Integration with Supabase

```
┌─────────────────────────────────────┐
│    SUPABASE AUTHENTICATION           │
├─────────────────────────────────────┤
│                                     │
│  Global: const supabase = ...       │
│                                     │
│  ✅ Fixed References:              │
│  │                                 │
│  ├─ supabase.auth.getUser()         │
│  │  └─ Used in: loadAdminProfile()  │
│  │                                 │
│  └─ supabase.auth.updateUser()      │
│     └─ Used in: changePassword()    │
│                                     │
│  ❌ Removed References:            │
│  │                                 │
│  └─ supabaseClient (undefined)      │
│     └─ Previously used (ERROR)      │
│                                     │
└─────────────────────────────────────┘
```

---

## Performance Optimizations

```
┌──────────────────────────────────────┐
│     PERFORMANCE STRATEGY              │
├──────────────────────────────────────┤
│                                      │
│ 1. DOM Manipulation                  │
│    ├─ Query once, cache results      │
│    ├─ Batch class updates            │
│    └─ Avoid unnecessary repaints     │
│                                      │
│ 2. CSS Over JavaScript               │
│    ├─ Use .active classes            │
│    ├─ Let CSS handle display         │
│    └─ No direct style manipulation   │
│                                      │
│ 3. localStorage Caching              │
│    ├─ Read once on page load         │
│    ├─ Write only on tab change       │
│    └─ ~20 bytes total usage          │
│                                      │
│ 4. Event Handling                    │
│    ├─ Direct onclick handlers        │
│    ├─ No event delegation needed     │
│    └─ Minimal overhead               │
│                                      │
└──────────────────────────────────────┘
```

---

## File Size Impact

```
┌─────────────────────────────────────────┐
│         FILE COMPOSITION                │
├─────────────────────────────────────────┤
│                                         │
│  Total Size: 116.92 KB                  │
│  Total Lines: 2604                      │
│                                         │
│  Breakdown:                             │
│  ├─ HTML structure: ~60% (70 KB)        │
│  ├─ CSS styling: ~30% (35 KB)           │
│  ├─ JavaScript code: ~10% (12 KB)       │
│  │                                     │
│  │ New additions:                      │
│  ├─ Tab CSS: +50 lines (~2 KB)          │
│  ├─ Tab HTML: +30 lines (~1 KB)         │
│  ├─ Tab JS: +30 lines (~0.5 KB)         │
│  │                                     │
│  └─ Total addition: ~3.5 KB (+3%)       │
│                                         │
└─────────────────────────────────────────┘
```

---

## Testing Matrix

```
┌──────────────────────────────────────────────────┐
│          DEVICE × FEATURE MATRIX                 │
├──────────────────────────────────────────────────┤
│                                                  │
│                │ Desktop │ Tablet │ Mobile │    │
│  ────────────────────────────────────────────   │
│  Tab Nav       │ Hidden  │ Shown  │ Shown  │    │
│  Padding       │ Normal  │ +70px  │ +70px  │    │
│  Tab Switch    │ Scroll  │ Tap    │ Tap    │    │
│  localStorage  │ Works   │ Works  │ Works  │    │
│  Dark Mode     │ ✓       │ ✓      │ ✓      │    │
│  Touch Events  │ N/A     │ ✓      │ ✓      │    │
│  RTL Layout    │ ✓       │ ✓      │ ✓      │    │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

**Diagram Version:** 1.0  
**Last Updated:** December 11, 2025  
**Status:** Complete ✅
