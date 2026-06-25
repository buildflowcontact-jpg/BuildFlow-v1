import { supabase } from '@/lib/supabaseClient';
import { unwrap } from '@/lib/unwrap';
import type { ChangeOrder } from '@/types/domain';
import type { TablesInsert, TablesUpdate } from '@/types/database.types';
import { activityLogsService } from './activityLogs.service';

export const changeOrdersService = {
  async list(projectId: string): Promise<ChangeOrder[]> {
    return unwrap(
      await supabase.from('change_orders').select('*').eq('project_id', projectId).order('number', { ascending: false })
    );
  },

  async create(payload: TablesInsert<'change_orders'>): Promise<ChangeOrder> {
    const changeOrder = unwrap(await supabase.from('change_orders').insert(payload).select('*').single());
    await activityLogsService.log({
      project_id: changeOrder.project_id,
      action: 'change_order.created',
      entity_type: 'change_order',
      entity_id: changeOrder.id,
      metadata: { number: changeOrder.number, title: changeOrder.title, cost_impact: changeOrder.cost_impact },
    });
    return changeOrder;
  },

  async update(id: string, payload: TablesUpdate<'change_orders'>): Promise<ChangeOrder> {
    return unwrap(await supabase.from('change_orders').update(payload).eq('id', id).select('*').single());
  },

  async submitForApproval(id: string): Promise<ChangeOrder> {
    return unwrap(
      await supabase.from('change_orders').update({ status: 'pending_approval' }).eq('id', id).select('*').single()
    );
  },

  /**
   * Approuve ou refuse un avenant de façon atomique côté base (fonction RPC
   * SECURITY DEFINER decide_change_order, cf. 0015_advanced_modules.sql) :
   * seule cette fonction peut faire passer le statut à 'approved'/'rejected',
   * les policies RLS classiques ne l'autorisent pas (WITH CHECK restreint aux
   * statuts non finaux). La signature est optionnelle (signature électronique
   * du client lors de l'approbation).
   */
  async decide(
    changeOrderId: string,
    approve: boolean,
    signature?: { data: string; signerName: string }
  ): Promise<void> {
    const { error } = await supabase.rpc('decide_change_order', {
      p_change_order_id: changeOrderId,
      p_approve: approve,
      p_signature_data: signature?.data ?? undefined,
      p_signer_name: signature?.signerName ?? undefined,
    });
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('change_orders').delete().eq('id', id);
    if (error) throw error;
  },
};
