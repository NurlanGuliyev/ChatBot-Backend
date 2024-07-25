import axios from 'axios';
import fs from 'fs/promises';

const WRITE_FILE = 'amenities.json';

const REQUEST_PAGE_SIZE = 100;

const REQUEST_URL = 'https://metarealtyinc.ca/wp-json/wp/v2/amenities?per_page=<per_page>&page=<page>';

const fetchAllPages = async () => {
  let page = 1;

  let allData = [];

  while (true) {
    try {
      const url = REQUEST_URL.replace('<per_page>', REQUEST_PAGE_SIZE).replace('<page>', page);

      const { data } = await axios.get(url);

        if (data.length === 0) break;

        const filteredData = data.map(({ id, name}) => ({
          id,
          name
        }));

        allData = [...allData, ...filteredData]

        page++;
    } catch (error) {
      console.error(`Error fetching data from page ${page}:`, error);
      
      break;
    }
  }

  return allData;
}

const runSeed = async () => {
    try {
      const allData = await fetchAllPages();

      const jsonData = JSON.stringify(allData, null, 2);
      
      await fs.writeFile(WRITE_FILE, jsonData, 'utf8');

      console.log(`Data has been saved to ${WRITE_FILE}`);
    } catch (error) {
      console.error('Error saving data to file:', error);
    }
}

runSeed()