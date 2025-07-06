# UI Style Guide for Agentic Markdown Todos

> **Purpose**: Prevent future UI inconsistencies and maintain design system standards  
> **Created**: January 2025  
> **Last Updated**: January 2025  

---

## 🎯 **Critical Design Standards**

### **Button Height Standardization** ⚠️ **MANDATORY**

**The Problem**: During development, button height inconsistencies led to poor visual alignment and broken mobile layouts.

**The Solution**: All buttons MUST use this standardized pattern:

```tsx
// ✅ CORRECT: Standardized Button Pattern
<button
  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors min-h-[32px] flex items-center justify-center"
>
  Button Text
</button>
```

**Required Classes for ALL Buttons**:
- `py-1.5` - Vertical padding for consistent height
- `min-h-[32px]` - Minimum height enforcement
- `flex items-center justify-center` - Perfect content centering

**Mobile Responsive Buttons**:
```tsx
// ✅ CORRECT: Mobile-responsive with icons
<button
  className="px-2 py-1.5 sm:px-3 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors min-h-[32px] flex items-center justify-center"
>
  <span className="hidden sm:inline">Save</span>
  <span className="sm:hidden">💾</span>
</button>
```

### **Button Variants**

**Primary Action Button**:
```tsx
className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm min-h-[32px] flex items-center justify-center"
```

**Secondary Button**:
```tsx
className="px-3 py-1.5 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors min-h-[32px] flex items-center justify-center"
```

**Danger/Delete Button**:
```tsx
className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors min-h-[32px] flex items-center justify-center"
```

---

## 📱 **Mobile-First Design Principles**

### **Responsive Text and Icons**

**Pattern**: Use icons on mobile, text on desktop
```tsx
// ✅ CORRECT
<button className="min-h-[32px] flex items-center justify-center">
  <span className="hidden sm:inline">Create New Task</span>
  <span className="sm:hidden">+</span>
</button>
```

**SVG Icons for Mobile**:
```tsx
// ✅ CORRECT: Proper SVG sizing
<svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
</svg>
```

### **Mobile Title Display**
```tsx
// ✅ CORRECT: Responsive title shortening
<h1 className="text-lg md:text-2xl font-bold">
  <span className="hidden sm:inline">Agentic Markdown Todos</span>
  <span className="sm:hidden">AM Todos</span>
</h1>
```

---

## 🔧 **Component Patterns**

### **Modal/Dialog Standards**

**Background Overlay**:
```tsx
className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
```

**Modal Container**:
```tsx
className="bg-gray-800 rounded-lg p-4 sm:p-6 max-w-md w-full"
```

### **Form Input Standards**

**Text Input**:
```tsx
className="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
```

**Textarea**:
```tsx
className="w-full h-96 bg-gray-900 text-white p-4 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm resize-vertical"
```

### **Sidebar Integration**

**Desktop Sidebar**:
```tsx
className="w-full bg-gray-800 border-r border-gray-700 flex flex-col h-screen md:h-full md:shadow-none shadow-2xl"
```

**Mobile Sidebar**:
```tsx
className="fixed md:relative z-30 md:z-auto transition-all duration-300 ease-in-out w-80 md:w-80 flex-shrink-0 h-full"
```

---

## 🎨 **Color System**

### **Priority Colors**
- **P1 (Critical)**: `bg-red-600`
- **P2 (High)**: `bg-orange-600`
- **P3 (Medium)**: `bg-yellow-600`
- **P4 (Low)**: `bg-blue-600`
- **P5 (Very Low)**: `bg-gray-600`

### **Status Colors**
- **Success**: `bg-green-600`
- **Warning**: `bg-yellow-600`
- **Error**: `bg-red-600`
- **Info**: `bg-blue-600`
- **Neutral**: `bg-gray-600`

### **Background Colors**
- **Primary Background**: `bg-gray-900`
- **Secondary Background**: `bg-gray-800`
- **Tertiary Background**: `bg-gray-700`
- **Border**: `border-gray-600` or `border-gray-700`

---

## 📏 **Spacing and Layout**

### **Standard Spacing**
- **Small**: `p-2` or `m-2` (8px)
- **Medium**: `p-4` or `m-4` (16px)
- **Large**: `p-6` or `m-6` (24px)

### **Component Spacing**
- **Button Gaps**: `space-x-2` (8px between buttons)
- **Section Gaps**: `space-y-4` (16px between sections)
- **Content Padding**: `p-4` for mobile, `p-6` for desktop

---

## 🔍 **Validation Rules**

### **Before Committing ANY UI Changes**

1. **Button Height Check**: All buttons must use `py-1.5 min-h-[32px] flex items-center justify-center`
2. **Mobile Testing**: Test on mobile breakpoint (< 640px)
3. **Visual Alignment**: Verify all interactive elements align properly
4. **Icon Consistency**: SVG icons should be `w-4 h-4` unless specifically larger

### **Code Review Checklist**

- [ ] All buttons use standardized height classes
- [ ] Mobile responsiveness includes proper icon/text switching
- [ ] No hardcoded heights that break consistency
- [ ] SVG icons have proper sizing classes
- [ ] Responsive breakpoints use `sm:`, `md:`, `lg:` prefixes correctly

---

## ❌ **Common Mistakes to Avoid**

### **Button Height Errors**
```tsx
// ❌ WRONG: Inconsistent padding
className="px-3 py-2 bg-blue-600"  // Different py value

// ❌ WRONG: Missing minimum height
className="px-3 py-1.5 bg-blue-600"  // No min-h-[32px]

// ❌ WRONG: Missing flex centering
className="px-3 py-1.5 min-h-[32px] bg-blue-600"  // No flex items-center justify-center
```

### **Mobile Responsiveness Errors**
```tsx
// ❌ WRONG: Text overflow on mobile
<span>Create New Task with Very Long Name</span>

// ❌ WRONG: Icons without proper sizing
<svg className="w-6 h-6">  // Too large for buttons

// ❌ WRONG: Missing responsive classes
<span>Always Visible Text</span>  // Should hide on mobile
```

### **Layout Errors**
```tsx
// ❌ WRONG: Hardcoded heights
style={{ height: '32px' }}  // Use min-h-[32px] instead

// ❌ WRONG: Inconsistent spacing
className="p-3"  // Should be p-2, p-4, or p-6
```

---

## 🛠 **Development Tools**

### **TailwindCSS Configuration Validation**

Ensure `postcss.config.js` uses object format:
```javascript
// ✅ CORRECT
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### **Browser Testing**

**Required Breakpoints**:
- Mobile: 320px - 639px
- Tablet: 640px - 1023px  
- Desktop: 1024px+

**Test Commands**:
```bash
# Build and test
npm run build
npm start

# Check for any styling issues
npm run test:basic
```

---

## 📚 **Implementation Examples**

### **Edit Mode Header (MarkdownViewer.tsx)**
```tsx
// ✅ CORRECT: Responsive edit mode buttons
<div className="flex items-center space-x-2 flex-shrink-0">
  <button
    onClick={handleCancel}
    className="px-2 py-1.5 sm:px-3 bg-gray-600 text-gray-200 rounded text-sm hover:bg-gray-500 transition-colors min-h-[32px] flex items-center justify-center"
  >
    <span className="hidden sm:inline">Cancel</span>
    <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
  <button
    onClick={handleSave}
    className="px-2 py-1.5 sm:px-3 rounded text-sm font-medium transition-colors min-h-[32px] flex items-center justify-center bg-green-600 text-white hover:bg-green-700"
  >
    <span className="hidden sm:inline">Save</span>
    <span className="sm:hidden">💾</span>
  </button>
</div>
```

### **Project Manager Mobile Button (ProjectManager.tsx)**
```tsx
// ✅ CORRECT: Mobile project button
<button
  onClick={() => setShowCreateModal(true)}
  className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-md text-sm min-h-[32px]"
>
  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
  <span className="truncate max-w-20">{currentProject}</span>
  <span>+</span>
</button>
```

---

## 🚨 **Emergency Fixes**

If button heights become inconsistent again:

1. **Find all button elements**:
   ```bash
   grep -r "className.*button\|<button" src/
   ```

2. **Apply the standard pattern**:
   - Add `py-1.5`
   - Add `min-h-[32px]` 
   - Add `flex items-center justify-center`

3. **Test immediately**:
   ```bash
   npm start
   # Check all pages for visual alignment
   ```

---

## 📞 **Support and Updates**

**When to Update This Guide**:
- New component patterns are introduced
- TailwindCSS version changes
- Mobile breakpoints change
- New button variants are needed

**Quick Reference**:
- **Standard Button**: `py-1.5 min-h-[32px] flex items-center justify-center`
- **Mobile Icon Size**: `w-4 h-4`
- **Responsive Text**: `hidden sm:inline` / `sm:hidden`

---

*Style guide maintained for consistency and developer efficiency*  
*Prevents the "button mess" and ensures professional UI standards* ✅