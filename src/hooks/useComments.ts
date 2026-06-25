import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentsService } from '@/services/comments.service';
import type { CommentParentType } from '@/types/database.types';
import { useAuthStore } from '@/stores/authStore';

export function useComments(parentType: CommentParentType, parentId: string | undefined, projectId: string | undefined) {
  const authorId = useAuthStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();
  const queryKey = ['comments', parentType, parentId];

  const query = useQuery({
    queryKey,
    queryFn: () => commentsService.list(parentType, parentId!),
    enabled: Boolean(parentId),
  });

  const create = useMutation({
    mutationFn: (content: string) =>
      commentsService.create({ project_id: projectId!, parent_type: parentType, parent_id: parentId!, author_id: authorId!, content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => commentsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { ...query, comments: query.data ?? [], create, remove };
}
