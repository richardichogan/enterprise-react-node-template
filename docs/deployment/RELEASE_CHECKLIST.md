# Release Checklist

## Pre-Release

### Code Quality

- [ ] All features tested locally
- [ ] No console errors or warnings
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] ESLint passes (`npm run lint`)
- [ ] All TODO comments addressed or documented
- [ ] Unused code removed
- [ ] Browser console logging removed or disabled

### Documentation

- [ ] README.md updated with latest features
- [ ] QUICKSTART.md reflects current setup
- [ ] DEPLOYMENT.md reviewed and accurate
- [ ] Environment variables documented in .env.example
- [ ] API documentation current
- [ ] Screenshots updated if UI changed

### Security

- [ ] No secrets or credentials in code
- [ ] .env files in .gitignore
- [ ] All dependencies up to date (`npm audit`)
- [ ] Security vulnerabilities addressed
- [ ] Azure AD permissions reviewed
- [ ] CORS settings configured correctly

### Version Control

- [ ] All changes committed to feature branches
- [ ] Feature branches merged to main
- [ ] No uncommitted changes
- [ ] Git tags created for version
- [ ] CHANGELOG.md updated

## GitHub Best Practices

### 1. Create a Release Branch (Optional for major releases)

```bash
git checkout -b release/v1.0.0
```

### 2. Update Version Number

- [ ] Update version in `package.json`
- [ ] Update version in documentation
- [ ] Create CHANGELOG.md entry

### 3. Tag the Release

```bash
git tag -a v1.0.0 -m "Release version 1.0.0 - Carbon Design System migration"
git push origin v1.0.0
```

### 4. Create GitHub Release

- [ ] Go to GitHub → Releases → New Release
- [ ] Select the tag (v1.0.0)
- [ ] Add release title: "v1.0.0 - Carbon Design System Migration"
- [ ] Add release notes describing changes
- [ ] Attach build artifacts if needed
- [ ] Mark as pre-release if applicable
- [ ] Publish release

### 5. Clean Up Branches

```bash
# Delete merged feature branches
git branch -d feature-interactive-details
git branch -d ui-design
git branch -d Dashboard-Updates

# Delete remote branches
git push origin --delete feature-interactive-details
git push origin --delete ui-design
git push origin --delete Dashboard-Updates
```

## Azure Deployment

### 1. Azure AD Configuration

- [ ] Redirect URI updated for production URL
- [ ] API permissions granted and admin consented
- [ ] Token configuration verified
- [ ] Supported account types configured

### 2. GitHub Secrets Configuration

- [ ] `AZURE_STATIC_WEB_APPS_API_TOKEN` added
- [ ] `VITE_AZURE_CLIENT_ID` added
- [ ] `VITE_AZURE_TENANT_ID` added
- [ ] `VITE_AZURE_REDIRECT_URI` added (production URL)
- [ ] `VITE_AZURE_WORKSPACE_ID` added
- [ ] `VITE_AZURE_SUBSCRIPTION_ID` added (if used)
- [ ] `VITE_AZURE_RESOURCE_GROUP` added (if used)

### 3. Azure Resources

- [ ] Static Web App or App Service created
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate enabled
- [ ] Application Insights enabled
- [ ] Log Analytics workspace permissions verified

### 4. Deploy

- [ ] Push to main branch (triggers GitHub Actions)
- [ ] Or manually deploy dist folder
- [ ] Verify deployment successful
- [ ] Test production site

## Post-Release

### Verification

- [ ] Production site loads correctly
- [ ] Authentication works
- [ ] All queries execute successfully
- [ ] DetailView opens and displays data
- [ ] Download JSON works
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Cross-browser testing (Chrome, Edge, Firefox, Safari)

### Monitoring

- [ ] Application Insights configured
- [ ] Error alerts set up
- [ ] Performance monitoring enabled
- [ ] User analytics tracking (if desired)

### Documentation

- [ ] Deployment documented
- [ ] Production URL documented
- [ ] Known issues documented
- [ ] Support contact information provided

### Communication

- [ ] Stakeholders notified
- [ ] User guide distributed
- [ ] Training scheduled (if needed)
- [ ] Feedback mechanism established

## Version Numbering

Follow Semantic Versioning (semver):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Current version: **0.1.0** (Initial release with Carbon Design System)

Suggested next version: **1.0.0** (First production release)
