import { loadOnlineFriends } from "@/lib/friends-data";
import { FriendsRail } from "@/components/friends/friends-rail";

/**
 * Carga la lista de amigos y pinta la columna flotante.
 *
 * Vive aparte del `AppShell` para poder colgarlo de un `Suspense` propio: la
 * consulta no tiene que retrasar header ni página. Si no hay amigos, el
 * cliente no monta nada.
 */
export async function FriendsRailHost({
  locale,
  userId,
}: {
  locale: string;
  userId: string;
}) {
  const { friends } = await loadOnlineFriends(userId);
  return <FriendsRail locale={locale} friends={friends} />;
}
