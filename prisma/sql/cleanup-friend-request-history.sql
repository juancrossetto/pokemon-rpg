-- Liberar solicitudes históricas que bloquean re-agregar amigos
DELETE FROM "FriendRequest"
WHERE status IN ('ACCEPTED', 'DECLINED', 'CANCELLED');
