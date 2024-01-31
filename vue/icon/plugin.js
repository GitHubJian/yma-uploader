const requireAll = requireContext => requireContext.keys().map(requireContext);
const req = require.context('./image/', false, /\.svg$/);

requireAll(req);
