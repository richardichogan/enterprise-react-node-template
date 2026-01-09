# Deployment Guide

## Quick Navigation

- **Frontend Deployment** (React/Vite): See "Azure Static Web Apps" below
- **Backend Deployment** (Node.js/Express): See [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md)

---

## Azure Web App Deployment

### Prerequisites

- Azure subscription
- Azure AD app registration (for authentication)
- Azure Monitor workspace with Sentinel data
- Backend API running (optional, see BACKEND_DEPLOYMENT.md)

### Option 1: Azure Static Web Apps (Recommended for Frontend)

1. **Create Azure Static Web App**

   ```bash
   az staticwebapp create \
     --name sentinel-dashboard \
     --resource-group <your-resource-group> \
     --location <region>
   ```

2. **Configure GitHub Actions Secrets**

   Go to GitHub repository → Settings → Secrets and variables → Actions

   Add the following secrets:

   - `AZURE_STATIC_WEB_APPS_API_TOKEN` - From Azure Portal → Static Web App → Manage deployment token
   - `VITE_AZURE_CLIENT_ID` - Your Azure AD app client ID
   - `VITE_AZURE_TENANT_ID` - Your Azure AD tenant ID
   - `VITE_AZURE_REDIRECT_URI` - Your production URL (e.g., https://yourapp.azurestaticapps.net)
   - `VITE_AZURE_WORKSPACE_ID` - Your Log Analytics workspace ID
   - `VITE_AZURE_SUBSCRIPTION_ID` - Your Azure subscription ID (optional)
   - `VITE_AZURE_RESOURCE_GROUP` - Your resource group name (optional)
   - `VITE_BACKEND_URL` - Backend API URL (e.g., https://acre-backend.azurewebsites.net) - **NEW**

3. **Update Azure AD App Registration**

   - Go to Azure Portal → Azure Active Directory → App registrations
   - Select your app
   - Under "Authentication" → Add your production redirect URI
   - Update `VITE_AZURE_REDIRECT_URI` to match production URL

4. **Push to main branch** - GitHub Actions will automatically build and deploy

### Option 2: Azure App Service

1. **Build the application**

   ```bash
   npm install
   npm run build
   ```

2. **Create App Service**

   ```bash
   az webapp create \
     --name sentinel-dashboard \
     --resource-group <your-resource-group> \
     --plan <your-app-service-plan> \
     --runtime "NODE|18-lts"
   ```

3. **Configure environment variables in Azure Portal**

   - Go to App Service → Configuration → Application settings
   - Add all VITE\_\* environment variables
   - Click "Save"

4. **Deploy**

   ```bash
   # Deploy using Azure CLI
   az webapp deployment source config-zip \
     --resource-group <your-resource-group> \
     --name sentinel-dashboard \
     --src dist.zip
   ```

   Or use VS Code Azure extension:

   - Right-click on `dist` folder
   - Select "Deploy to Static Website"

### Post-Deployment Steps

1. **Update Azure AD Redirect URIs**

   - Add production URL to Azure AD app registration
   - Update CORS settings if needed

2. **Configure custom domain** (optional)

   - Add custom domain in Azure Portal
   - Configure DNS records
   - Enable SSL certificate

3. **Set up monitoring**

   - Enable Application Insights
   - Configure alerts for errors
   - Set up log streaming

4. **Security checklist**
   - ✅ All secrets stored in Azure Key Vault or GitHub Secrets
   - ✅ HTTPS enforced
   - ✅ CORS properly configured
   - ✅ Azure AD authentication required
   - ✅ Content Security Policy headers set

## Manual Build and Deploy

If not using GitHub Actions:

```bash
# 1. Create production .env file
cp .env.example .env
# Edit .env with production values

# 2. Install dependencies
npm ci --production=false

# 3. Build
npm run build

# 4. Test production build locally
npm run preview

# 5. Deploy dist folder to Azure
# Use Azure CLI, VS Code extension, or FTP
```

## Environment Variables Reference

| Variable                     | Required | Description                               |
| ---------------------------- | -------- | ----------------------------------------- |
| `VITE_AZURE_CLIENT_ID`       | Yes      | Azure AD application client ID            |
| `VITE_AZURE_TENANT_ID`       | Yes      | Azure AD tenant ID                        |
| `VITE_AZURE_REDIRECT_URI`    | Yes      | Application redirect URI (production URL) |
| `VITE_AZURE_WORKSPACE_ID`    | Yes      | Log Analytics workspace ID                |
| `VITE_AZURE_SUBSCRIPTION_ID` | No       | Azure subscription ID                     |
| `VITE_AZURE_RESOURCE_GROUP`  | No       | Resource group name                       |

## Troubleshooting

### Authentication Issues

- Verify redirect URI matches exactly in Azure AD
- Check CORS settings in Azure AD app registration
- Ensure user has proper permissions to Log Analytics workspace

### Build Failures

- Run `npm ci` to ensure clean dependency install
- Check Node.js version (18+ required)
- Verify all environment variables are set

### Runtime Errors

- Check browser console for specific errors
- Verify Azure AD token permissions
- Check Application Insights logs
