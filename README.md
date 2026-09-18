# Haraj Scraper Pro (حراج السعودية)

The most advanced, reliable, and cost-effective scraper for **Haraj.com.sa**. Extract real estate, cars, and general listings with their full details, prices, and seller phone numbers seamlessly. 

Built with Playwright and a smart network-interception engine, this Actor bypasses modern anti-bot protections while minimizing your Apify compute unit (CU) usage by blocking unnecessary media loads.

## 🌟 Key Features
* **Smart Extraction:** Dynamically intercepts Haraj's backend data (API/JSON) for 100% accuracy without relying on fragile HTML parsing.
* **Native Webhook Support:** Send a real-time HTTP POST notification to your server, Zapier, or Make as soon as the run finishes.
* **Cost-Optimized:** Aborts heavy images, fonts, and CSS during the scraping process to save Residential Proxy bandwidth.
* **Structured Output:** Delivers clean, mapped JSON/CSV data ready for your CRM or Google Sheets.

---

## 📥 Input Parameters

| Field | Type | Description |
| :--- | :--- | :--- |
| **`search`** (Required) | String | The keyword to search for (e.g., `شقة للايجار`, `تويوتا كامري`). |
| **`city`** | String | Filter by city name (e.g., `الرياض`, `جدة`). Leave empty for all cities. |
| **`maxResults`** | Integer | Maximum number of listings to scrape. Default: `20`. |
| **`onlyWithImage`** | Boolean | Set to `true` to exclude listings without photos. |
| **`webhookUrl`** | String | Optional: Your Zapier Catch Hook or Custom Server URL for instant notifications. |
| **`proxyConfiguration`** | Object | **MUST** be set to `RESIDENTIAL` proxy to prevent blocking. |

---

## 📤 Output Data Structure

The Actor pushes the extracted data into the Apify Dataset. You can download it in JSON, CSV, Excel, or XML. Here is a sample output:

```json
{
  "name": "شقة 3 غرف للايجار في حي الملقا",
  "phone": "0500000000",
  "maps_url": "[https://haraj.com.sa/111111111/](https://haraj.com.sa/111111111/)",
  "url": "[https://haraj.com.sa/111111111/](https://haraj.com.sa/111111111/)",
  "niche": "شقة للايجار",
  "source": "haraj",
  "price_sar": "45000",
  "city": "الرياض",
  "description": "شقة عوائل مجددة بالكامل، 3 غرف نوم، صالة، مطبخ راكب...",
  "images": [
    "[https://m.haraj.com.sa/image1.jpg](https://m.haraj.com.sa/image1.jpg)"
  ],
  "has_image": true,
  "_raw_id": "111111111"
}
