/*
 * RESTArrayLoader manages and loads an array of items from a URL pattern
 * aURLPattern - The URL to be fetched. It contains an @ sign that indicates how to add the index for the current item to be loaded
 * aDataTYpe - The type of get. Typical values is 'xml' & 'json'
 * aConstructor - The constructor to invoke for the data type called with params (response, RESTArrayLoader, index, user passed object)
 * aoUserDataForCallback - Pointer to an object that will also be passed into the constructor
 */

var gLS_RDL_NUMBER_OF_FAILURES = 0;
var gLS_RDL_MAX_NUMBER_OF_RETRIES = 5;

var gLS_RDL_NUMBER_OF_PENDING_REQUESTS = 0;
var gLS_RDL_MAX_SIMUL_REQUESTS = 4;

function RESTDictionaryLoader( aURLPattern, aDataType, aConstructor, aoUserConstructorArgument, aDefaultObject) {
    this.mdObjects = new Array();              // the array you are loading
    this.mdIsGetPending  = new Array();        // true if fetch is out
    this.mdHintedForLoad = new Array();             // Contains a stack of things that are hinted for load
    this.mdCallbacks = new Array();             // Contains an array per element of what callbacks to be called when object is loaded
	this.mdCalledCallbacks = new Array();
    this.msURLPattern = aURLPattern;
    this.msDataType = aDataType;
    this.mcConstructor = aConstructor;
    this.moUserConstructorArgument = aoUserConstructorArgument;
    this.moDefaultObject = aDefaultObject;
    this.msCache = true;

    if( DebugIsMaskOn("NOCACHE")) {
        this.msCache = "false";
    }

    // Gets length of current object
    this.length = function() {
        return this.mdObjects.length;
    };

    // Get object with index
    this.Get = function( aiIndex ) {
        return this.mdObjects[aiIndex];
    };

    // Get object for a certain index. If it does not exist it returns the default object
    // If the function is called without params the first object or the default object will be called
    this.GetOrDefault = function( aiIndex ) {
        //console.log("GetOrDefault aiIndex=" + aiIndex );
        // No parameter means get anything or default
        if( aiIndex == undefined ) {
            for( var tItem in this.mdObjects ) {
                return this.mdObjects[tItem];
            }
            return this.moDefaultObject;
        }

        if( this.mdObjects[aiIndex] == undefined ) {
            //console.log("Undefined: Returning object ->\n" + this.moDefaultObject +"\n---\n");
            return this.moDefaultObject;
        }

        //console.log("Found: Returning object ->\n" + this.mdObjects[aiIndex] +"\n---\n");

        return this.mdObjects[aiIndex];
    };

    // Will call all functions that wait for this object
    this.ChainCallbacks = function( aiIndex ) {
       if( this.mdCallbacks[aiIndex] != undefined ) {
           var tCallback;
           while( (tCallback = this.mdCallbacks[aiIndex].pop() ) != undefined  ) {
               //console.log( this.mdObjects[aiIndex]);
               tCallback.Call( this.mdObjects[aiIndex] );
           }
       }
    };

    this.PushCallback = function( aiIndex, acCallback ) {
        if( this.mdCallbacks[aiIndex] == undefined ) {
            this.mdCallbacks[aiIndex] = new Array();
	        this.mdCalledCallbacks[aiIndex] = new Array();
        } else {
	        // Ok we have previously pushed callbacks to this index.. Check if we already called this function
		    for( var tiCallBackIndex in this.mdCalledCallbacks[aiIndex] ) {
			    var toCallBack =  this.mdCalledCallbacks[aiIndex][tiCallBackIndex];
			    if( toCallBack.IsSameCallback( acCallback ) ) {
				    return false;
			    }
		    }
        }

	    this.mdCalledCallbacks[aiIndex].push( acCallback );
	    this.mdCallbacks[aiIndex].push( acCallback );
	    return true;
    }

    // Wait for object to be loaded. When it is loaded the callback will be called
    // Callback parameters (object to be loaded, aiIndex, aoUserData )
    this.Then = function( aiIndex, acCallback ) {

        if( this.PushCallback(aiIndex, acCallback) ) {
		    if( this.IsLoaded(aiIndex)) {
		        this.ChainCallbacks( aiIndex );
		    } else if( !this.IsPending(aiIndex ) )  {
		        this.ExecuteLoad( aiIndex );
		    }
        }
    };

    // Schedules a load when opportune time arrives
    this.HintForLoad = function (aiIndex, acCallback) {

        if( this.PushCallback(aiIndex, acCallback) ) {
	        if( this.IsLoaded(aiIndex)) {
	            this.ChainCallbacks( aiIndex );
	        } else if( !this.IsPending( aiIndex) ) {
	            this.mdHintedForLoad[aiIndex] = aiIndex;
	            this.DoHintedLoads();
	        }
        }
    };

    // Returns true if the aIndex is loaded. Otherwise returns false
    this.IsLoaded = function( aiIndex ) {
         if( this.mdObjects[aiIndex] == undefined ) {
             return false;
         }
        return true;
    };

    // Returns true if the aIndex is loaded. Otherwise returns false
    this.IsPending = function( aiIndex ) {
        if( this.mdIsGetPending[aiIndex] == undefined ) {
            return false;
        }
        return true;
    };

    // Returns true if all scheduled and hintend loads are done
    this.IsFullyLoaded = function() {
        if( gLS_RDL_NUMBER_OF_PENDING_REQUESTS == 0 && this.mdHintedForLoad.length == 0 ) {
            return true;
        }

        return false;
    };


    // Returns an array of loaded indices. Used for iteration
    this.GetLoadedIndices = function() {
        return GetIndicesArrayFromDictionary( this.mdObjects );
    };

    // ------------------- Load Functions -------------------

    this.HandleError = function(xhr, aStatus, aError) {
		gLS_RDL_NUMBER_OF_FAILURES++;
		gLS_RDL_NUMBER_OF_PENDING_REQUESTS--;
		this.theRESTLoader.mdIsGetPending[this.objectIndex]= undefined;

		if( gLS_RDL_NUMBER_OF_FAILURES <= gLS_RDL_MAX_NUMBER_OF_RETRIES ) {
			this.theRESTLoader.ExecuteLoad( this.objectIndex );
			return;
		} else {
						
		}
        switch( xhr.status ){
			case 404:                

				break;
			case 403: 
				
				break;	
			case 500:
				
				
			    break;
			default:		
		}
        
    };
	
	this.InjectObject = function( iObjectIndex, aData ) {
		var tFakeAJAX = new Object();
		tFakeAJAX.objectIndex = iObjectIndex;
		tFakeAJAX.theRESTLoader = this;
		this.HandleResponse.call( tFakeAJAX, aData );		
	}

    this.HandleResponse = function( aData , aText, aResponse ) {
        gLS_RDL_NUMBER_OF_PENDING_REQUESTS--;
        this.theRESTLoader.mdIsGetPending[this.objectIndex]= undefined;

        // Call the constructor with the response string
        var toObject = new this.theRESTLoader.mcConstructor( aData, this.theRESTLoader, this.objectIndex,  this.theRESTLoader.moUserConstructorArgument );

        this.theRESTLoader.mdObjects[this.objectIndex] = toObject;

         // If we get a successful load back we attempt schedule more of them
        this.theRESTLoader.DoHintedLoads();

        this.theRESTLoader.ChainCallbacks( this.objectIndex );
    };

    // Loads from a URL. (Private)
    this.ExecuteLoad = function (aIndex ) {
        if (aIndex != undefined && !this.IsLoaded(aIndex) && !this.IsPending(aIndex)) {

            this.mdIsGetPending[aIndex] = true;
            gLS_RDL_NUMBER_OF_PENDING_REQUESTS++;

            if ( /*window.XDomainRequest*/ false) { //To support IE In the future
				var tsURL = this.GetURLFromIndex(aIndex);

                tsURL += '.'+this.msDataType;

                var xdr = new XDomainRequest();
				xdr.onprogress = function () { };
				xdr.ontimeout = function () { };
                xdr.timeout = 10000;
                xdr.onerror = this.HandleError;
                xdr.objectIndex = aIndex;   // Make sure the xdr object that gets passed in HandleResponse matches the ajax object
                xdr.theRESTLoader = this;
                xdr.onload = function () {

                    var parsedData;
                    if( xdr.theRESTLoader.msDataType == 'xml' ){
                        parsedData = $.parseXML( xdr.responseText );
                    } else {
                        parsedData = $.parseJSON( xdr.responseText );
                        if (parsedData == null || typeof (parsedData) == 'undefined')
                        {
                            parsedData = $.parseJSON(data.firstChild.textContent);
                        }
                    }
                    xdr.theRESTLoader.HandleResponse.call(xdr,parsedData);
                };
                xdr.open("get", tsURL);
                setTimeout(function () {
					xdr.send();
				}, 0);
            } else {
				var tsURL = this.GetURLFromIndex(aIndex);
				tsURL += '.'+this.msDataType;
                jQuery.support.cors = true;
                $.ajax({
                    url:tsURL,
                    type:'GET',
                    cache: this.msCache,
                    dataType:this.msDataType,
                    timeout: 10000,
                    theRESTLoader:this,
                    beforeSend: function(xhr) { },
                    objectIndex:aIndex,
                    userSuccessFunction:this.HandleResponse,
                    success:this.HandleResponse,
                    error:this.HandleError
                });
            }

        }
    };

    // Schedules hinted loads
    this.DoHintedLoads = function () {
        // if we have few enough requests out and there are hints left
        while (gLS_RDL_NUMBER_OF_PENDING_REQUESTS < gLS_RDL_MAX_SIMUL_REQUESTS && this.mdHintedForLoad.length > 0) {
            this.ExecuteLoad(this.mdHintedForLoad.pop());
        }
    };

    this.GetURLFromIndex = function(aiIndex) {
        if( aiIndex == undefined )
            return "GetURLFromIndex: Error: Cant get URL from undefined index";
        return this.msURLPattern.replace("@", aiIndex);
    }

    this.toString = function () {
		var tsRet = "RestDictionary";
        return tsRet;
    };
}