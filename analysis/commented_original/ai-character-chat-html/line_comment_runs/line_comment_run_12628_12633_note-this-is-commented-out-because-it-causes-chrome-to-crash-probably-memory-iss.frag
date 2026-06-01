      // Note: This is commented out because it causes Chrome to crash (probably memory issues)
      // let storePromises = Object.entries(data.stores).map(async ([storeName, rows]) => {
      //   await db[storeName].clear(); // Clear existing data
      //   await db[storeName].bulkAdd(rows);
      // });
      // await Promise.all(storePromises);
