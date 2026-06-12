import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, payload } = req.body;
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  // Client with service role key to bypass RLS for admin actions
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  // Client with user's token to verify identity
  const supabaseUser = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY);

  try {
    // 1. Verify who is calling
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. Check if caller is admin or superadmin
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile) {
      return res.status(403).json({ error: 'Profile not found' });
    }

    const isSuperadmin = callerProfile.role === 'superadmin';
    const isAdmin = callerProfile.role === 'admin';

    if (!isSuperadmin && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }

    // 3. Perform action
    if (action === 'update_user') {
      const { id, full_name, phone } = payload;
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ full_name, phone })
        .eq('id', id);

      if (updateError) throw updateError;
      return res.status(200).json({ success: true });
    }
    
    if (action === 'delete_user') {
      const { id } = payload;
      
      // Get target user to check their role
      const { data: targetUser } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', id)
        .single();
        
      if (targetUser?.role === 'superadmin' && !isSuperadmin) {
        return res.status(403).json({ error: 'Cannot delete superadmin' });
      }

      // First delete from auth.users (this automatically cascades to public.users if fk cascade is set)
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(id);
      
      if (deleteAuthError) {
        // Fallback to just deleting from public.users if auth admin API fails
        const { error: deleteError } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('id', id);
        if (deleteError) throw deleteError;
      }
      
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Admin action error:', error);
    return res.status(500).json({ error: error.message });
  }
}
