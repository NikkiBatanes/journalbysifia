# 🔧 LINT FIX PLAN - Phase by Phase

## 📊 CURRENT STATUS
- **Total Issues**: 469 (290 errors, 179 warnings)
- **Auto-fixable**: 26 warnings
- **Files Affected**: 113 files

---

## 📈 ISSUE BREAKDOWN BY TYPE

| Error Type | Count | Severity | Auto-Fix |
|------------|-------|----------|----------|
| `@typescript-eslint/no-unused-vars` | 227 | Error | ❌ |
| `react-native/no-inline-styles` | 70 | Warning | ❌ |
| `react-hooks/exhaustive-deps` | 35 | Warning | ⚠️ |
| `no-undef` | 28 | Error | ❌ |
| `no-bitwise` | 28 | Warning | ❌ |
| `@typescript-eslint/no-shadow` | 23 | Warning | ❌ |
| `no-trailing-spaces` | 19 | Warning | ✅ |
| `no-catch-shadow` | 11 | Warning | ❌ |
| `curly` | 4 | Warning | ✅ |
| `comma-dangle` | 3 | Warning | ✅ |
| `radix` | 2 | Warning | ✅ |
| Other | 19 | Mixed | ⚠️ |

---

## 📁 ISSUE BREAKDOWN BY CATEGORY

| Category | Files | Total Issues | Errors | Warnings |
|----------|-------|--------------|--------|----------|
| **Components** | 49 | 152 | 103 | 49 |
| **Screens** | 25 | 119 | 75 | 44 |
| **Services** | 19 | 76 | 55 | 21 |
| **Other** | 15 | 79 | 53 | 26 |
| **Supabase** | 3 | 26 | 1 | 25 |
| **Utils** | 2 | 17 | 3 | 14 |

---

## 🎯 PHASE-BY-PHASE EXECUTION PLAN

### **PHASE 1: Quick Wins - Auto-Fixable Issues** ⚡
**Target**: 26 warnings (5.5% of total)
**Effort**: Low | **Risk**: Minimal | **Time**: 15 mins

| Step | Action | Count | Command |
|------|--------|-------|---------|
| 1.1 | Auto-fix trailing spaces | 19 | `npm run lint -- --fix` |
| 1.2 | Auto-fix curly braces | 4 | Manual review after auto-fix |
| 1.3 | Auto-fix comma-dangle | 3 | Manual review after auto-fix |

**Success Criteria**: 443 issues remaining (94.5%)

---

### **PHASE 2: Unused Variables Cleanup** 🧹
**Target**: 227 errors (48.4% of total)
**Effort**: Medium | **Risk**: Low | **Time**: 2-3 hours

#### **2A: Low-Risk Files (Services & Utils)**
**Target**: ~60 errors (12.8%)

| Priority | Files | Issues | Strategy |
|----------|-------|--------|----------|
| High | `guidedPromptGatingService.ts` | 14 | Remove unused imports/vars |
| High | `NewSubscriptionService.ts` | 13 | Remove unused params |
| High | `AppleStoreKitService.ts` | 9 | Prefix with `_` if needed |
| Medium | Other services | ~24 | Systematic cleanup |

**Success Criteria**: 383 issues remaining (81.7%)

#### **2B: Medium-Risk Files (Components)**
**Target**: ~100 errors (21.3%)

| Priority | Files | Issues | Strategy |
|----------|-------|--------|----------|
| High | `TimeBlockLogEditor.tsx` | 7 | Remove unused vars |
| High | `ReflectionLogEditor.tsx` | 9 | Remove unused imports |
| High | `GratitudeLogEditor.tsx` | 8 | Clean up unused state |
| High | `PrayerJournalReactQuery.tsx` | 8 | Remove unused functions |
| Medium | Other components | ~68 | Systematic cleanup |

**Success Criteria**: 283 issues remaining (60.3%)

#### **2C: High-Risk Files (Screens)**
**Target**: ~67 errors (14.3%)

| Priority | Files | Issues | Strategy |
|----------|-------|--------|----------|
| Critical | `UserProfileScreen.tsx` | 17 | Careful review - complex logic |
| High | `DevotionalDetailScreen.tsx` | 8 | Remove unused state |
| High | `OnboardingTrialOfferScreen.tsx` | 7 | Clean up unused props |
| Medium | Other screens | ~35 | Systematic cleanup |

**Success Criteria**: 216 issues remaining (46.1%)

---

### **PHASE 3: Inline Styles Extraction** 🎨
**Target**: 70 warnings (14.9% of total)
**Effort**: Medium | **Risk**: Medium | **Time**: 2-3 hours

| Priority | Component | Issues | Strategy |
|----------|-----------|--------|----------|
| High | `EnhancedMomentsRenderer.tsx` | 11 | Extract to StyleSheet |
| High | `TimeBlockLogEditor.tsx` | 9 | Extract to StyleSheet |
| High | `PrayerJournalReactQuery.tsx` | 12 | Extract to StyleSheet |
| Medium | Other components | ~38 | Systematic extraction |

**Approach**:
1. Identify inline styles
2. Extract to StyleSheet.create()
3. Test UI/UX unchanged
4. Verify no layout shifts

**Success Criteria**: 146 issues remaining (31.1%)

---

### **PHASE 4: React Hooks Dependencies** ⚛️
**Target**: 35 warnings (7.5% of total)
**Effort**: High | **Risk**: High | **Time**: 3-4 hours

| Priority | File | Issues | Strategy |
|----------|------|--------|----------|
| Critical | Review each useEffect | - | Add missing deps or disable with comment |
| High | Test behavior after fixes | - | Ensure no infinite loops |
| Medium | Add exhaustive-deps comments | - | Document intentional omissions |

**Approach**:
1. Review each useEffect/useCallback/useMemo
2. Add missing dependencies
3. Test for infinite loops
4. Add `// eslint-disable-next-line` with justification if needed

**Success Criteria**: 111 issues remaining (23.7%)

---

### **PHASE 5: Undefined Variables** 🔍
**Target**: 28 errors (6.0% of total)
**Effort**: Medium | **Risk**: Medium | **Time**: 1-2 hours

| Priority | Action | Strategy |
|----------|--------|----------|
| High | Add missing imports | Check all `no-undef` errors |
| High | Fix typos in variable names | Review context |
| Medium | Add type definitions | If needed |

**Success Criteria**: 83 issues remaining (17.7%)

---

### **PHASE 6: Variable Shadowing** 👥
**Target**: 23 warnings (4.9% of total)
**Effort**: Low | **Risk**: Low | **Time**: 1 hour

| Priority | Action | Strategy |
|----------|--------|----------|
| High | Rename shadowed variables | Use descriptive names |
| Medium | Review scope conflicts | Ensure no logic breaks |

**Success Criteria**: 60 issues remaining (12.8%)

---

### **PHASE 7: Bitwise Operations** 🔢
**Target**: 28 warnings (6.0% of total)
**Effort**: Low | **Risk**: Minimal | **Time**: 30 mins

| File | Issues | Strategy |
|------|--------|----------|
| `guidedPromptGating.ts` | 14 | Add `// eslint-disable-next-line no-bitwise` |
| `guidedPromptGatingService.ts` | 14 | Add comments explaining hash logic |

**Note**: These are intentional hash functions - disable with comments

**Success Criteria**: 32 issues remaining (6.8%)

---

### **PHASE 8: Catch Shadow & Misc** 🎯
**Target**: 32 remaining issues (6.8% of total)
**Effort**: Low | **Risk**: Low | **Time**: 1 hour

| Issue Type | Count | Strategy |
|------------|-------|----------|
| `no-catch-shadow` | 11 | Rename catch variables |
| `radix` | 2 | Add radix parameter to parseInt |
| Other misc | 19 | Case-by-case fixes |

**Success Criteria**: 0 issues remaining (0%)

---

## 📊 PROGRESS TRACKING TABLE

| Phase | Target Issues | % of Total | Cumulative % Fixed | Remaining | Effort | Risk |
|-------|---------------|------------|-------------------|-----------|--------|------|
| **Start** | 469 | 100% | 0% | 469 | - | - |
| **Phase 1** | 26 | 5.5% | 5.5% | 443 | Low | Minimal |
| **Phase 2A** | 60 | 12.8% | 18.3% | 383 | Medium | Low |
| **Phase 2B** | 100 | 21.3% | 39.7% | 283 | Medium | Low |
| **Phase 2C** | 67 | 14.3% | 53.9% | 216 | Medium | Medium |
| **Phase 3** | 70 | 14.9% | 68.9% | 146 | Medium | Medium |
| **Phase 4** | 35 | 7.5% | 76.3% | 111 | High | High |
| **Phase 5** | 28 | 6.0% | 82.3% | 83 | Medium | Medium |
| **Phase 6** | 23 | 4.9% | 87.2% | 60 | Low | Low |
| **Phase 7** | 28 | 6.0% | 93.2% | 32 | Low | Minimal |
| **Phase 8** | 32 | 6.8% | 100% | 0 | Low | Low |

---

## 🎯 RECOMMENDED EXECUTION ORDER

### **Week 1: Foundation (Phases 1-2)**
- Day 1: Phase 1 (Auto-fixes)
- Day 2-3: Phase 2A (Services)
- Day 4-5: Phase 2B (Components)

### **Week 2: UI & Logic (Phases 3-5)**
- Day 1-2: Phase 2C (Screens)
- Day 3-4: Phase 3 (Inline styles)
- Day 5: Phase 5 (Undefined vars)

### **Week 3: Polish (Phases 4, 6-8)**
- Day 1-3: Phase 4 (React hooks) - CAREFUL
- Day 4: Phase 6 (Shadowing)
- Day 5: Phases 7-8 (Cleanup)

---

## ⚠️ CRITICAL SAFETY RULES

1. **NO UI/UX Changes**: Visual appearance must remain identical
2. **NO Behavior Changes**: Functionality must work exactly the same
3. **Test After Each File**: Run app and test affected features
4. **Commit Frequently**: Small, atomic commits per file/feature
5. **Review Before Merge**: Manual QA on affected screens
6. **Backup First**: Ensure git is clean before starting

---

## 🧪 TESTING CHECKLIST PER PHASE

- [ ] App builds successfully
- [ ] No new TypeScript errors
- [ ] Affected screens render correctly
- [ ] User interactions work as before
- [ ] No console errors/warnings
- [ ] Navigation flows unchanged
- [ ] Data persistence works

---

## 📝 NOTES

- **jest.setup.js**: 28 errors - may need special handling (test environment)
- **Supabase functions**: Low priority - backend code
- **Hash functions**: Bitwise operations are intentional - add disable comments
- **React hooks**: Highest risk - test thoroughly for infinite loops

---

## 🚀 READY TO START?

**Recommended First Step**: 
```bash
npm run lint -- --fix
```

This will auto-fix 26 issues and give us a clean baseline to work from.
