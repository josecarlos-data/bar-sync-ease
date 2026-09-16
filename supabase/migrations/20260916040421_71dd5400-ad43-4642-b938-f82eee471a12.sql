
CREATE POLICY "item images readable by bar" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'item-images' AND public.can_view_bar(((storage.foldername(name))[1])::uuid));

CREATE POLICY "item images writable by admin" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'item-images' AND public.is_admin_of(((storage.foldername(name))[1])::uuid));

CREATE POLICY "item images updatable by admin" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'item-images' AND public.is_admin_of(((storage.foldername(name))[1])::uuid));

CREATE POLICY "item images deletable by admin" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'item-images' AND public.is_admin_of(((storage.foldername(name))[1])::uuid));
