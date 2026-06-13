fetch('https://slkdoaeacjxgkviicaot.supabase.co/functions/v1/debug-trx')
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data, null, 2)))
