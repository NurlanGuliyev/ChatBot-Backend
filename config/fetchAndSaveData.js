import axios from 'axios';
import fs from 'fs/promises';

async function fetchAllPages() {
  const baseUrl = 'https://metarealtyinc.ca/wp-json/wp/v2/amenities?per_page=100&page=';
  let page = 1;
  let allData = [];
  let hasData = true;

  while (hasData) {
    try {
      const response = await axios.get(baseUrl + page);
      const data = response.data;

      if (data.length > 0) {
        // Filter data to include only the specified properties
        const filteredData = data.map(item => ({
          id: item.id,
          name: item.name
        }));
        allData = allData.concat(filteredData);
        page++;
      } else {
        hasData = false;
      }
    } catch (error) {
      console.error(`Error fetching data from page ${page}:`, error);
      hasData = false;
    }
  }

  return allData;
}

export async function saveDataToFile() {
  try {
    const allData = await fetchAllPages();
    const jsonData = JSON.stringify(allData, null, 2); // Pretty-print JSON with 2 spaces indentation
    await fs.writeFile('amenities.json', jsonData, 'utf8');
    console.log('Data has been saved to allData.json');
  } catch (error) {
    console.error('Error saving data to file:', error);
  }
}
