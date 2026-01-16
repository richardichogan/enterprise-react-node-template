# Azure AI Foundry Migration Guide

## What We've Done

✅ Installed Azure SDK packages (`@azure/search-documents`, `@azure/openai`)  
✅ Created `azureSearchService.js` - Hybrid search with vector embeddings  
✅ Updated `documentProcessor.js` - Uses Azure Search when available, falls back to blob storage  
✅ Added `.env` variables for Azure Search configuration

## Current Status

Your code is **ready** but needs Azure AI Search resource to be created.

**What Works Now:**
- Code falls back to your existing Azure Blob Storage chunking
- No breaking changes - everything continues to work

**What's Missing:**
- Azure AI Search resource (needs to be created in Azure Portal)
- Search index (needs to be created and populated with documents)

---

## Next Steps: Create Azure AI Search

### Option 1: Azure Portal (Recommended)

1. **Go to Azure Portal**: https://portal.azure.com

2. **Create Azure AI Search**:
   - Click "+ Create a resource"
   - Search for "Azure AI Search"
   - Click "Create"
   
3. **Configuration**:
   - **Subscription**: Your subscription
   - **Resource Group**: Same as your storage account (e.g., `rfi-helper-rg`)
   - **Service name**: `rfi-helper-search` (or your choice)
   - **Location**: Same as your OpenAI resource
   - **Pricing tier**: 
     - **Basic** ($250/month) - Recommended for production
     - **Free** ($0) - For testing (limited to 50 MB, 3 indexes)

4. **Get Keys**:
   - After creation, go to your search service
   - Click "Keys" in left menu
   - Copy the **URL** (e.g., `https://rfi-helper-search.search.windows.net`)
   - Copy the **Primary admin key**

5. **Update `.env`**:
   ```env
   AZURE_SEARCH_ENDPOINT=https://rfi-helper-search.search.windows.net
   AZURE_SEARCH_API_KEY=<your-primary-admin-key>
   ```

### Option 2: Azure CLI (Faster)

```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name rfi-helper-rg --location eastus

# Create Azure AI Search
az search service create \
  --name rfi-helper-search \
  --resource-group rfi-helper-rg \
  --sku basic \
  --location eastus

# Get admin key
az search admin-key show \
  --resource-group rfi-helper-rg \
  --service-name rfi-helper-search

# Copy the "primaryKey" value to your .env file
```

---

## Step 2: Create Search Index

Once you have Azure Search created, run this script to create the index:

```bash
cd server
node scripts/create-search-index.js
```

This will create an index with:
- **Text fields**: content, title, fileName
- **Vector field**: contentVector (1536 dimensions for text-embedding-ada-002)
- **Hybrid search**: Combines keyword + semantic vector search

---

## Step 3: Index Your Documents

Two options:

### A. Auto-Index on Upload (Recommended)

Your upload endpoint will automatically index documents when they're uploaded (code already added).

### B. Bulk Index Existing Documents

If you already have documents in blob storage, run:

```bash
cd server
node scripts/index-existing-documents.js
```

This will:
1. List all documents in your blob storage
2. Extract text from each
3. Generate embeddings
4. Upload to Azure AI Search

**Time estimate**: ~30 seconds per document (embedding generation is slow)

---

## How It Works Now

1. **User asks a question** in RFI Helper
2. **System checks**: Is Azure Search configured?
   - ✅ **YES**: Use Azure AI Search (hybrid search with embeddings)
   - ❌ **NO**: Fall back to blob storage chunking (current behavior)
3. **GPT-4o generates answer** using retrieved context

**Benefits of Azure Search:**
- Better retrieval quality (semantic search)
- Finds relevant content even without exact keyword matches
- Faster search (indexed vs. loading entire documents)
- Handles large document sets better

---

## Testing

After setup, test the search:

```bash
cd server
node scripts/test-search.js
```

This will:
- Search for "IBM Consulting Dynamics 365"
- Show top 5 results with relevance scores
- Verify search is working correctly

---

## Cost Estimate

**Basic Tier ($250/month fixed cost):**
- 2 GB storage
- 15 million documents
- 3 replicas for high availability
- 50 queries/second

**Plus usage costs:**
- OpenAI embeddings: ~$0.0001 per 1K tokens
- For 100 documents (avg 5 pages each): ~$2-5 one-time indexing cost

**Total first month**: ~$255-260  
**Ongoing**: ~$250/month

---

## Rollback (If Needed)

To revert to blob storage only:

1. Remove Azure Search variables from `.env`:
   ```env
   # AZURE_SEARCH_ENDPOINT=
   # AZURE_SEARCH_API_KEY=
   ```

2. Code automatically falls back to blob storage chunking

---

## Questions?

- **Azure Search not showing results?** Check that documents are indexed
- **Embeddings failing?** Verify `text-embedding-ada-002` deployment exists
- **Search seems slow?** First query always slower (cold start)
- **Want to customize chunk size?** Edit `azureSearchService.js` line 95

