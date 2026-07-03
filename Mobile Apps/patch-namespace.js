const fs = require('fs');
const file = 'node_modules/react-native-thermal-receipt-printer-image-qr/android/build.gradle';
let data = fs.readFileSync(file, 'utf8');
if (!data.includes('namespace')) {
  data = data.replace('android {', 'android {\n    namespace "com.reactnativethermalreceiptprinter"');
  fs.writeFileSync(file, data);
  console.log('Patched');
}
