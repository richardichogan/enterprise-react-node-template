# Azure Blob Storage Setup for RFI-Helper

## 1. Create Azure Storage Account

### Option A: Azure Portal (Easiest)
1. Go to https://portal.azure.com
2. Search for "Storage accounts" → Click "Create"
3. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Storage account name**: `rfihelper<yourname>` (must be globally unique, lowercase, no spaces)
   - **Region**: Choose closest to you
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally Redundant Storage - cheapest)
4. Click "Review + Create" → "Create"
5. Wait ~1 minute for deployment

### Option B: Azure CLI (Fastest)
```powershell
# Login to Azure
az login

# Create resource group (if needed)
az group create --name rfi-helper-rg --location eastus

# Create storage account
az storage account create \
  --name rfihelper<yourname> \
  --resource-group rfi-helper-rg \
  --location eastus \
  --sku Standard_LRS
```

## 2. Create Blob Container

### Azure Portal:
1. Go to your storage account
2. Click "Containers" (left menu)
3. Click "+ Container"
4. Name: `rfi-documents`
5. Public access level: **Private** (default)
6. Click "Create"

### Azure CLI:
```powershell
az storage container create \
  --name rfi-documents \
  --account-name rfihelper<yourname>
```

## 3. Get Access Keys

### Azure Portal:
1. Go to your storage account
2. Click "Access keys" (left menu, under Security + networking)
3. Click "Show" next to key1
4. Copy:
   - **Storage account name**: `rfihelper<yourname>`
   - **Key**: The long key string

### Azure CLI:
```powershell
az storage account keys list \
  --account-name rfihelper<yourname> \
  --resource-group rfi-helper-rg
```

## 4. Update .env File

Add to `server/.env`:
```env
AZURE_STORAGE_ACCOUNT_NAME=rfihelper<yourname>
AZURE_STORAGE_ACCOUNT_KEY=<your-key-from-step-3>
AZURE_STORAGE_CONTAINER_NAME=rfi-documents
```

## 5. Test Connection

Run:
```powershell
node test-azure-blob.js
```

## 💰 Cost Estimate

- **Storage**: ~$0.018 per GB per month
- **Operations**: ~$0.004 per 10,000 operations
- **For RFI documents**: Likely < $1/month

## 🔐 Security Notes

- Access keys are sensitive - never commit to git
- `.env` is already in `.gitignore`
- Use Azure AD authentication in production (more secure)
