/*
Copyright IBM Corp 2016 All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

		 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package main

import (
	"fmt"
    "strconv"
	"encoding/json"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

// SimpleChaincode example simple Chaincode implementation
type SimpleChaincode struct {
}

var claimIndexStr = "_claimindex"

type ClaimPayment struct {
    Policy string `json:"policy"`
    Amount string `json:"amount"`
    Vehicle string `json:"vehicle"`
    Owner string `json:"owner"`
	Role string `json:"role"`
	State string `json:"state"`
}

// ============================================================================================================================
// Main
// ============================================================================================================================
func main() {
	err := shim.Start(new(SimpleChaincode))
	if err != nil {
		fmt.Printf("Error starting Simple chaincode: %s", err)
	}
}

// ============================================================================================================================
// Init - reset all the things
// ============================================================================================================================
func (t *SimpleChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	_, args := stub.GetFunctionAndParameters()
    var Aval int
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	// Initialize the chaincode
	Aval, err = strconv.Atoi(args[0])
	if err != nil {
		return shim.Error("Expecting a numeric string argument to Init()")
	}

	// Write the state to the ledger
	err = stub.PutState("abc", []byte(strconv.Itoa(Aval)))				//making a test var "abc", I find it handy to read/write to it right away to test the network
	if err != nil {
		return shim.Error(err.Error())
	}

	var empty []string
	jsonAsBytes, _ := json.Marshal(empty)								//marshal an emtpy array of strings to clear the index
	err = stub.PutState(claimIndexStr, jsonAsBytes)
	if err != nil {
		return shim.Error(err.Error())
	}

	fmt.Println(" - ready for action")                          //self-test pass
	return shim.Success(nil)
}

func (t *SimpleChaincode) Run(stub shim.ChaincodeStubInterface) pb.Response {
	function, _  := stub.GetFunctionAndParameters()
	fmt.Println("run is running " + function)
	return t.Invoke(stub)
}

// ============================================================================================================================
// Invoke - Our entry point for Invocations
// ============================================================================================================================
func (t *SimpleChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()	
	fmt.Println("invoke is running " + function)

	// Handle different functions
	if function == "init" {													//initialize the chaincode state, used as reset
		return t.Init(stub)
	} else if function == "delete" {										//deletes an entity from its state
		return Delete(stub, args)
	} else if function == "write" {											//writes a value to the chaincode state
		return Write(stub, args)
	} else if function == "init_claim_payment" {							//create a new claim payment
		return init_claim_payment(stub, args)
	} else if function == "set_owner" {										//change owner of a claim payment
		return set_owner(stub, args)
	}
	fmt.Println("invoke did not find func: " + function)					//error

	return shim.Error("Received unknown invoke function name - '" + function + "'")
}



// ============================================================================================================================
// Query - Our entry point for Queries
// ============================================================================================================================
func (t *SimpleChaincode) Query(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	fmt.Println("query is running " + function)

	// Handle different functions
	if function == "read" {													//read a variable
		return read(stub, args)
	}
	fmt.Println("query did not find func: " + function)						//error

	return shim.Error("Unknown supported call - Query()")
}

// ============================================================================================================================
// Read - read a variable from chaincode state
// ============================================================================================================================
func read(stub shim.ChaincodeStubInterface, args []string) pb.Response {	
	var name, jsonResp string
	var err error

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting key of the var to query")
	}

	name = args[0]
	valAsbytes, err := stub.GetState(name)									//get the var from chaincode state
	if err != nil {
		jsonResp = "{\"Error\":\"Failed to get state for " + name + "\"}"
		return shim.Error(jsonResp)
	}

	return shim.Success(valAsbytes)													//send it onward
}

// ============================================================================================================================
// Delete - remove a key/value pair from state
// ============================================================================================================================
func Delete(stub shim.ChaincodeStubInterface, args []string) (pb.Response) {
	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	name := args[0]
	err := stub.DelState(name)													//remove the key from chaincode state
	if err != nil {
		return shim.Error("Failed to delete state")
	}

	//get the claim index
	claimsAsBytes, err := stub.GetState(claimIndexStr)
	if err != nil {
		return shim.Error("Failed to get claim index")
	}
	var claimIndex []string
	json.Unmarshal(claimsAsBytes, &claimIndex)								//un stringify it aka JSON.parse()

	//remove claim from index
	for i,val := range claimIndex{
		fmt.Println(strconv.Itoa(i) + " - looking at " + val + " for " + name)
		if val == name{															//find the correct claim
			fmt.Println("found claim")
			claimIndex = append(claimIndex[:i], claimIndex[i+1:]...)			//remove it
			for x:= range claimIndex{											//debug prints...
				fmt.Println(string(x) + " - " + claimIndex[x])
			}
			break
		}
	}
	jsonAsBytes, _ := json.Marshal(claimIndex)									//save new index
	err = stub.PutState(claimIndexStr, jsonAsBytes)
	return shim.Success(nil)
}

// ============================================================================================================================
// Write - write variable into chaincode state
// ============================================================================================================================
func Write(stub shim.ChaincodeStubInterface, args []string) pb.Response {	
	var name, value string // Entities
	var err error
	fmt.Println("running write()")

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2. key of the variable and value to set")
	}

	name = args[0]															//rename for funsies
	value = args[1]
	err = stub.PutState(name, []byte(value))								//write the variable into the chaincode state
	if err != nil {
		return shim.Error(err.Error())
	}
	return shim.Success(nil)
}

// ============================================================================================================================
// claim_in_array - check if a claim is in the array
// ============================================================================================================================
func claim_in_array(claim string, list []string) bool {
 	for _, v := range list {
 		if v == claim {
 			return true
 		}
 	}
 	return false
 }

// ============================================================================================================================
// Init Claim - create a new claim payment, store into chaincode state
// ============================================================================================================================
func init_claim_payment(stub shim.ChaincodeStubInterface, args []string) (pb.Response) {
	//   0           1                  2                       3            4           5
	// "BS87947", "267.32", "2009 Land Rover Freelander", "Steve Atkin", "Adjustor", "In Process"

	if len(args) != 6 {
		return shim.Error("Incorrect number of arguments. Expecting 6")
	}

	fmt.Println("- start init claim payment")
	
	amount, err := strconv.ParseFloat(args[1], 32)
	if err != nil {
		return shim.Error("2nd argument must be a floating point string")
	}

	policy         := "\"policy\":\""+args[0]+"\", "							
	value          := "\"amount\":\"" + strconv.FormatFloat(amount, 'f', -1, 32) + "\", "
	vehicle        := "\"vehicle\":\"" + args[2] + "\", "
	owner          := "\"owner\":\"" + args[3] + "\", "
	role           := "\"role\":\"" + args[4] + "\", "
	state          := "\"state\":\"" + args[5] + "\" "

	str := "{"+policy+value+vehicle+owner+role+state+"}"

	//get the array of claims
	claimsAsBytes, err := stub.GetState(claimIndexStr)
	if err != nil {
		return shim.Error("Failed to get claim list")
	}
	var claimIndex []string
	//un stringify it aka JSON.parse()
	json.Unmarshal(claimsAsBytes, &claimIndex)

	// See if the claim is already in the claims array, as only one entry per claim is allowed
	if claim_in_array(args[0], claimIndex) {
		return shim.Error("Claim is already in claim list")
	}

	// Also check to see if the claim was saved but was not in the claims array for some reason
	record, err := stub.GetState(args[0])
	if record != nil {
		return shim.Error("Claim is already in BlockChain")
	}
	
	// Store claim with policy id as key
	err = stub.PutState(args[0], []byte(str))
	if err != nil {
		return shim.Error(err.Error())
	}
								
	// Add the claim policy to index list
	claimIndex = append(claimIndex, args[0])							
	fmt.Println("! claim index: ", claimIndex)
	jsonAsBytes, _ := json.Marshal(claimIndex)
	// Store policy id of claim
	err = stub.PutState(claimIndexStr, jsonAsBytes)						 

	fmt.Println("- end init claim payment")
	return shim.Success(nil)
}

// ============================================================================================================================
// Set Owner Permission on Claim Payment
// ============================================================================================================================
func set_owner(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var err error

	//   0            1               2             3
	// "BS87947", "Steve Atkin", "Policy Holder", "Paid"
	if len(args) < 4 {
		return shim.Error("Incorrect number of arguments. Expecting 4")
	}
	
	fmt.Println("- start set owner")
	fmt.Println(args[0] + " - " + args[1])
	claimAsBytes, err := stub.GetState(args[0])
	if err != nil {
		return shim.Error("Failed to get claim payment")
	}
	res := ClaimPayment{}
	//un stringify it aka JSON.parse()
	json.Unmarshal(claimAsBytes, &res)
	//Update the owner, role, and state of the claim										
	res.Owner = args[1]														
	res.Role = args[2]
	res.State = args[3]

	jsonAsBytes, _ := json.Marshal(res)
	//rewrite the claim payment with id as key
	err = stub.PutState(args[0], jsonAsBytes)								
	if err != nil {
		return shim.Error(err.Error())
	}
	
	fmt.Println("- end set owner")
	return shim.Success(nil)
}
