import Host from './screens/Host';
import Player from './screens/Player';
import Showroom from './screens/Showroom';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path.endsWith('/showroom')) return <Showroom />;
  const isHost = path.endsWith('/host');
  return <div className="app">{isHost ? <Host /> : <Player />}</div>;
}
