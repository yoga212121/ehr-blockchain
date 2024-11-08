import { Box, Divider, FormControl, Modal, TextField, Typography, Backdrop, CircularProgress } from '@mui/material'
import React, { useCallback } from 'react'
import { useState } from 'react'
import CustomButton from '../../components/CustomButton'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import useEth from '../../contexts/EthContext/useEth'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import useAlert from '../../contexts/AlertContext/useAlert'
import AddRecordModal from './AddRecordModal'
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded'
import ipfs from '../../ipfs'
import Record from '../../components/Record'

const Doctor = () => {
  const {
    state: { contract, accounts, role, loading },
  } = useEth()
  const { setAlert } = useAlert()

  const [patientExist, setPatientExist] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)  // Track access status
  const [searchPatientAddress, setSearchPatientAddress] = useState('')
  const [addPatientAddress, setAddPatientAddress] = useState('')
  const [records, setRecords] = useState([])
  const [addRecord, setAddRecord] = useState(false)

  const searchPatient = async () => {
    try {
      // Validate wallet address format
      if (!/^(0x)?[0-9a-f]{40}$/i.test(searchPatientAddress)) {
        setAlert('Please enter a valid wallet address', 'error');
        return;
      }
  
      // Check if the patient exists
      const patientExists = await contract.methods.getPatientExists(searchPatientAddress).call({ from: accounts[0] });
      setPatientExist(patientExists);
  
      if (patientExists) {
        // Check if the doctor has access to the patient's records
        const accessGranted = await contract.methods.checkAccess(searchPatientAddress).call({ from: accounts[0] });
        setHasAccess(accessGranted);
  
        if (accessGranted) {
          // Fetch and display the patient's records
          const records = await contract.methods.getRecords(searchPatientAddress).call({ from: accounts[0] });
          setRecords(records);
        } else {
          setAlert('Access denied to this patient’s records', 'error');
        }
      } else {
        setAlert('Patient does not exist', 'error');
      }
    } catch (err) {
      console.error("Error searching for patient:", err);
    }
  };
  

  const registerPatient = async () => {
    try {
      await contract.methods.addPatient(addPatientAddress).send({ from: accounts[0] })
      setAlert('Patient registered successfully', 'success')
    } catch (err) {
      console.error(err)
      setAlert('Failed to register patient', 'error')
    }
  }

  const addRecordCallback = useCallback(
    async (buffer, fileName, patientAddress) => {
      if (!patientAddress) {
        setAlert('Please search for a patient first', 'error');
        return;
      }
  
      try {
        // Check permission to add records
        const accessGranted = await contract.methods.checkAccess(patientAddress).call({ from: accounts[0] });
        
        if (!accessGranted) {
          setAlert("You don't have permission to add records for this patient", 'error');
          return;
        }
  
        // Upload the file to IPFS
        const res = await ipfs.add(buffer);
        const ipfsHash = res.path || res.cid?.toString();
  
        if (ipfsHash) {
          // Store IPFS hash on the blockchain
          await contract.methods.addRecord(ipfsHash, fileName, patientAddress).send({ from: accounts[0] });
          setAlert('New record uploaded', 'success');
          setAddRecord(false);
  
          // Refresh the records list for the patient
          const records = await contract.methods.getRecords(patientAddress).call({ from: accounts[0] });
          setRecords(records);
        } else {
          setAlert('IPFS upload failed - no hash returned', 'error');
        }
      } catch (err) {
        setAlert('Record upload failed', 'error');
        console.error("Error uploading record to IPFS or blockchain:", err);
      }
    },
    [contract, accounts, setAlert, setAddRecord, setRecords]
  );
  

  if (loading) {
    return (
      <Backdrop sx={{ color: '#fff', zIndex: theme => theme.zIndex.drawer + 1 }} open={loading}>
        <CircularProgress color='inherit' />
      </Backdrop>
    )
  } else {
    return (
      <Box display='flex' justifyContent='center' width='100vw'>
        <Box width='60%' my={5}>
          {!accounts ? (
            <Box display='flex' justifyContent='center'>
              <Typography variant='h6'>Open your MetaMask wallet to get connected, then refresh this page</Typography>
            </Box>
          ) : (
            <>
              {role === 'unknown' && (
                <Box display='flex' justifyContent='center'>
                  <Typography variant='h5'>You're not registered, please go to home page</Typography>
                </Box>
              )}
              {role === 'patient' && (
                <Box display='flex' justifyContent='center'>
                  <Typography variant='h5'>Only doctor can access this page</Typography>
                </Box>
              )}
              {role === 'doctor' && (
                <>
                  <Modal open={addRecord} onClose={() => setAddRecord(false)}>
                    <AddRecordModal
                      handleClose={() => setAddRecord(false)}
                      handleUpload={addRecordCallback}
                      patientAddress={searchPatientAddress}
                    />
                  </Modal>

                  <Typography variant='h4'>Patient Records</Typography>
                  <Box display='flex' alignItems='center' my={1}>
                    <FormControl fullWidth>
                      <TextField
                        variant='outlined'
                        placeholder='Search patient by wallet address'
                        value={searchPatientAddress}
                        onChange={e => setSearchPatientAddress(e.target.value)}
                        InputProps={{ style: { fontSize: '15px' } }}
                        InputLabelProps={{ style: { fontSize: '15px' } }}
                        size='small'
                      />
                    </FormControl>
                    <Box mx={2}>
                      <CustomButton text={'Search'} handleClick={searchPatient}>
                        <SearchRoundedIcon style={{ color: 'white' }} />
                      </CustomButton>
                    </Box>
                    <CustomButton text={'New Record'} handleClick={() => setAddRecord(true)} disabled={!patientExist || !hasAccess}>
                      <CloudUploadRoundedIcon style={{ color: 'white' }} />
                    </CustomButton>
                  </Box>

                  {patientExist && !hasAccess && (
                    <Box display='flex' alignItems='center' justifyContent='center' my={5}>
                      <Typography variant='h5'>Access denied to this patient’s records</Typography>
                    </Box>
                  )}

                  {patientExist && hasAccess && records.length === 0 && (
                    <Box display='flex' alignItems='center' justifyContent='center' my={5}>
                      <Typography variant='h5'>No records found</Typography>
                    </Box>
                  )}

                  {patientExist && hasAccess && records.length > 0 && (
                    <Box display='flex' flexDirection='column' mt={3} mb={-2}>
                      {records.map((record, index) => (
                        <Box mb={2} key={index}>
                          <Record record={record} />
                        </Box>
                      ))}
                    </Box>
                  )}

                  <Box mt={6} mb={4}>
                    <Divider />
                  </Box>

                  <Typography variant='h4'>Register Patient</Typography>
                  <Box display='flex' alignItems='center' my={1}>
                    <FormControl fullWidth>
                      <TextField
                        variant='outlined'
                        placeholder='Register patient by wallet address'
                        value={addPatientAddress}
                        onChange={e => setAddPatientAddress(e.target.value)}
                        InputProps={{ style: { fontSize: '15px' } }}
                        InputLabelProps={{ style: { fontSize: '15px' } }}
                        size='small'
                      />
                    </FormControl>
                    <Box mx={2}>
                      <CustomButton text={'Register'} handleClick={registerPatient}>
                        <PersonAddAlt1RoundedIcon style={{ color: 'white' }} />
                      </CustomButton>
                    </Box>
                  </Box>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    )
  }
}

export default Doctor
