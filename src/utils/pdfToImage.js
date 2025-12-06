const path = require("path");
const fs = require("fs");
const { fromPath } = require("pdf2pic");

const convertPdfToImages = async (pdfPath, outputDir) => {
  const converter = fromPath(pdfPath, {
    density: 150,
    saveFilename: "page",
    savePath: outputDir,
    format: "png",
    width: 800,
    height: 1000,
  });

  const pageCount = await converter.numberOfPages();

  const results = [];
  for (let page = 1; page <= pageCount; page++) {
    const output = await converter(page);
    results.push(output.path);
  }

  return results;
};

module.exports = { convertPdfToImages };
