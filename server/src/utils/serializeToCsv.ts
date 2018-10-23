import * as stringify from 'csv-stringify';


export function serializeToCsv (data: string[][]) {
  return new Promise((resolve, reject) => {
    stringify(data, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve(output);
      }
    });
  });
}
