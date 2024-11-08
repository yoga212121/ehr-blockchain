import React, { useReducer, useCallback, useEffect } from "react";
import Web3 from "web3";
import EthContext from "./EthContext";
import { reducer, actions, initialState } from "./state";

function EthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const init = useCallback(
    async (artifact) => {
      if (artifact) {
        const web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");
        const accounts = await web3.eth.requestAccounts();
        const networkID = await web3.eth.net.getId();
        const { abi } = artifact;
        let address, contract;

        try {
          // Ensure the artifact has networks for the current network ID
          const network = artifact.networks ? artifact.networks[networkID] : null;
          if (network && network.address) {
            address = network.address;
            contract = new web3.eth.Contract(abi, address);
          } else {
            console.error(`No contract deployed on network ID: ${networkID}`);
            return;  // Exit early if there's no deployment on the network
          }
        } catch (err) {
          console.error("Error setting up contract:", err);
        }

        // Dispatch data for use in context
        dispatch({
          type: actions.init,
          data: { artifact, web3, accounts, networkID, contract },
        });
      }
    },
    []
  );

  useEffect(() => {
    const tryInit = async () => {
      try {
        const artifact = require("../../contracts/SimpleStorage.json");
        init(artifact);
      } catch (err) {
        console.error("Error loading contract artifact:", err);
      }
    };

    tryInit();
  }, [init]);

  useEffect(() => {
    const events = ["chainChanged", "accountsChanged"];
    const handleChange = () => {
      init(state.artifact);  // Re-initialize on account or chain change
    };

    events.forEach((e) => window.ethereum.on(e, handleChange));
    return () => {
      events.forEach((e) => window.ethereum.removeListener(e, handleChange));
    };
  }, [init, state.artifact]);

  return (
    <EthContext.Provider value={{ state, dispatch }}>
      {children}
    </EthContext.Provider>
  );
}

export default EthProvider;
