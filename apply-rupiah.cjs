const fs = require('fs');

const injectCode = `
const formatInputRp = (val) => {
  if (val === 0 || val === '0') return '0';
  if (!val) return '';
  return val.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
};

const handleRpInput = (field, event) => {
  const target = event.target;
  let val = target.value.replace(/[^0-9]/g, '');
  form.value[field] = val ? parseInt(val, 10) : 0;
  target.value = formatInputRp(form.value[field]);
};
`;

const processFile = (file) => {
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('const formatInputRp')) {
    content = content.replace('</script>', injectCode + '\n</script>');
  }

  content = content.replace(
    /<input v-model\.number="form\.saldo" type="number"/g, 
    `<input :value="formatInputRp(form.saldo)" @input="handleRpInput('saldo', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.harga_beli" type="number"/g, 
    `<input :value="formatInputRp(form.harga_beli)" @input="handleRpInput('harga_beli', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.harga_jual" type="number"/g, 
    `<input :value="formatInputRp(form.harga_jual)" @input="handleRpInput('harga_jual', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.stok" type="number"/g, 
    `<input :value="formatInputRp(form.stok)" @input="handleRpInput('stok', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.nominal_awal" type="number"/g, 
    `<input :value="formatInputRp(form.nominal_awal)" @input="handleRpInput('nominal_awal', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.keuntungan" type="number"/g, 
    `<input :value="formatInputRp(form.keuntungan)" @input="handleRpInput('keuntungan', $event)" type="text"`
  );

  content = content.replace(
    /<input v-model\.number="form\.akhir_persentase" type="number"/g, 
    `<input :value="formatInputRp(form.akhir_persentase)" @input="handleRpInput('akhir_persentase', $event)" type="text"`
  );

  fs.writeFileSync(file, content);
  console.log('Processed ' + file);
};

processFile('src/views/admin/counter/FundsView.vue');
processFile('src/views/admin/counter/VoucherView.vue');
processFile('src/views/admin/counter/PerdanaView.vue');
processFile('src/views/admin/counter/AccView.vue');
processFile('src/views/admin/counter/MarginView.vue');
