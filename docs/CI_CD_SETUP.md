# CI/CD Setup Guide

## 🚀 GitHub Actions Pipeline

### **Overview**

The siFia project uses GitHub Actions for automated CI/CD pipeline with the following workflows:

- **Main CI/CD Pipeline** - Code quality, testing, security, and builds
- **Dependency Cache** - Optimize dependency management
- **Release** - Automated releases with version tagging

---

## 📋 Workflows

### **1. Main CI/CD Pipeline** (`.github/workflows/ci-cd.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` branch

**Jobs:**

#### **Quality Check**
- ✅ ESLint code quality checks
- ✅ Unit tests execution (136 tests)
- ✅ TypeScript compilation validation
- ✅ Zero tolerance for linting errors

#### **Security Audit**
- ✅ NPM vulnerability scanning
- ✅ Secret detection (TruffleHog)
- ✅ Dependency audit (moderate threshold)

#### **Android Build**
- ✅ Automated APK compilation
- ✅ Artifact upload and storage
- ✅ Gradle cache optimization

#### **iOS Build** (main branch only)
- ✅ iOS simulator build
- ✅ CocoaPods dependency management
- ✅ Xcode project compilation

#### **TestFlight Deployment** (main branch only)
- ✅ iOS archive creation
- ✅ TestFlight upload
- ✅ Automated staging deployment

#### **Performance Analysis**
- ✅ Bundle size analysis
- ✅ Performance budget checks (< 10MB)
- ✅ Bundle optimization reports

---

### **2. Dependency Cache** (`.github/workflows/dependency-cache.yml`)

**Triggers:**
- Package.json changes
- Daily schedule (2 AM UTC)

**Features:**
- ✅ Dependency caching optimization
- ✅ Outdated dependency detection
- ✅ Security vulnerability scanning

---

### **3. Release Pipeline** (`.github/workflows/release.yml`)

**Triggers:**
- Version tags (v1.0.0, v1.1.0, etc.)

**Features:**
- ✅ Automated release creation
- ✅ Android release APK generation
- ✅ iOS release IPA generation
- ✅ GitHub release asset uploads

---

## 🔧 Required Secrets

### **GitHub Repository Secrets**

Add these secrets to your GitHub repository settings:

#### **iOS Deployment**
```
APPLE_ID                    # Apple Developer email
APPLE_APP_PASSWORD          # App-specific password
TEAM_ID                     # Apple Developer Team ID
PROVISIONING_PROFILE        # iOS provisioning profile name
```

#### **General**
```
GITHUB_TOKEN               # GitHub token (auto-provided)
```

---

## 📱 Build Artifacts

### **Android**
- **Debug APK:** Available in GitHub Actions artifacts
- **Release APK:** Generated on version tags
- **Bundle Size:** Monitored and optimized

### **iOS**
- **Debug Build:** iOS simulator build
- **Release IPA:** Generated on version tags
- **TestFlight:** Auto-deploy on main branch pushes

---

## 🚀 Deployment Process

### **Development Workflow**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
# CI/CD runs automatically on PR
```

### **Production Deployment**
```bash
# Merge to main triggers full pipeline
git checkout main
git merge feature/new-feature
git push origin main

# CI/CD automatically:
# ✅ Runs all tests
# ✅ Builds Android APK
# ✅ Builds iOS app
# ✅ Deploys to TestFlight
```

### **Release Creation**
```bash
# Tag version for release
git tag v1.0.0
git push origin v1.0.0

# CI/CD automatically:
# ✅ Creates GitHub release
# ✅ Builds release APK/IPA
# ✅ Uploads release assets
```

---

## 📊 Pipeline Monitoring

### **Status Checks**
- ✅ All jobs must pass for merge
- ✅ Security audit must pass
- ✅ Performance budgets enforced
- ✅ Code quality standards maintained

### **Notifications**
- ✅ Success notifications on completion
- ✅ Failure alerts with detailed logs
- ✅ Performance metrics in summaries

---

## 🔍 Troubleshooting

### **Common Issues**

#### **Build Failures**
```bash
# Check GitHub Actions logs
# Verify environment variables
# Ensure dependencies are up to date
```

#### **Security Audit Failures**
```bash
# Fix vulnerabilities
npm audit fix

# Update dependencies
npm update
```

#### **Performance Budget Exceeded**
```bash
# Analyze bundle size
npx react-native-bundle-visualizer

# Optimize imports and dependencies
```

#### **TestFlight Upload Failures**
```bash
# Verify Apple credentials
# Check provisioning profile
# Ensure team ID is correct
```

---

## 📈 Performance Metrics

### **CI/CD Performance**
- **Build Time:** ~10-15 minutes
- **Cache Hit Rate:** > 80%
- **Success Rate:** > 95%

### **Quality Gates**
- **Test Coverage:** 100% (136/136 tests)
- **Linting:** 0 errors, 0 warnings
- **Security:** Moderate vulnerability threshold
- **Bundle Size:** < 10MB target

---

## 🔄 Pipeline Optimization

### **Caching Strategy**
- ✅ Node modules cached
- ✅ Gradle dependencies cached
- ✅ CocoaPods cached
- ✅ Build artifacts optimized

### **Parallel Execution**
- ✅ Quality checks run in parallel
- ✅ Security audit independent
- ✅ Multiple platform builds
- ✅ Performance analysis concurrent

---

## 📞 Support

### **CI/CD Issues**
1. Check GitHub Actions logs
2. Verify secret configuration
3. Review workflow syntax
4. Check dependency versions

### **Build Issues**
1. Review build logs
2. Check environment setup
3. Verify platform-specific requirements
4. Validate configuration files

---

**Last Updated:** 2025-11-24
**Version:** 1.0.0
