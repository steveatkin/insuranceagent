$(document).ready(function () {


    $("#submit-policy").click( function(){
        var customer = $("#policy").val();
        var claim = null;

        // Setup the callback that is invoked when a policy is found.
        var policyResponsePayloadSetter = Policy.setResponsePayload;

        Policy.setResponsePayload = function(data) {
            policyResponsePayloadSetter.call(Policy, data);
            claim = data;

            $("#reason").val(data.claimReason);
            $("#vehicle").val(data.vehicle);

            // Localize the display of the currency
            if(typeof Intl != "undefined") {
                var formattedValue = new Intl.NumberFormat('default',
                    { style: 'currency', currency: 'USD' }).format(new Number(data.totalClaimAmount));
                $("#amount").val(formattedValue);
            }
            else {
                $("#amount").val(data.totalClaimAmount);
            }

            console.log("CLAIM: " + JSON.stringify(claim));
            // Get the block chain entry for this claim
            BlockChain.getPolicy(customer);
        };

        var policyBlockChainPayloadSetter = BlockChain.setResponsePayload;

        BlockChain.setResponsePayload = function(data) {
            policyBlockChainPayloadSetter.call(BlockChain, data);

            // There is no block chain entry for this claim so create a new one
            if ($.isEmptyObject(data)) {
                console.log("No block chain entry for this claim: " + claim.customer);
                var block = {
                    customer: claim.customer,
                    amount: claim.totalClaimAmount,
                    vehicle: claim.vehicle,
                    owner: 'Unassigned'
                };
                // Store the claim for this policy in the block chain
                BlockChain.setPolicy(block);
            }
            else {
                $("#assignment").val(data.owner);
                console.log("FOUND BLOCK: " + JSON.stringify(data));
            }
        };

        // Get the policy and claim for this customer
        Policy.getPolicy(customer, 'en');
    });

});