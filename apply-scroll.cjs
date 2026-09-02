const fs = require('fs');

const processFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  
  // 1. Add vertical scroll and max-height to the table wrapper
  content = content.replace(
    /<div class="overflow-x-auto">/g,
    '<div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-220px)]">'
  );

  // 2. Make the header sticky
  content = content.replace(
    /<thead class="bg-gray-50\/50 text-gray-500 font-medium">/g,
    '<thead class="bg-gray-50 text-gray-500 font-medium sticky top-0 z-10 shadow-sm">'
  );

  fs.writeFileSync(file, content);
  console.log('Processed ' + file);
};

[
  'src/views/admin/counter/FundsView.vue',
  'src/views/admin/counter/VoucherView.vue',
  'src/views/admin/counter/PerdanaView.vue',
  'src/views/admin/counter/AccView.vue',
  'src/views/admin/counter/MarginView.vue'
].forEach(f => processFile(f));
