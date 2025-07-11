import { ReportHandler } from 'web-vitals';

const reportWebVitals = (onPerfEntry?: ReportHandler) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getINP, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getINP(onPerfEntry); // Replaced getFID with getINP (new recommended metric)
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
