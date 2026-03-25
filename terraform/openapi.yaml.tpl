swagger: "2.0"
info:
  title: plant-tracker-api
  description: Plant Tracker REST API
  version: "1.0.0"
host: "api.plants.lopezcloud.dev"
basePath: "/"
schemes:
  - https
produces:
  - application/json
consumes:
  - application/json

securityDefinitions:
  api_key:
    type: apiKey
    name: x-api-key
    in: header

x-google-backend:
  address: ${function_url}
  path_translation: APPEND_PATH_TO_ADDRESS
  jwt_audience: ${function_url}

paths:
  /health:
    get:
      operationId: healthCheck
      summary: Health check
      responses:
        "200":
          description: OK

  /plants:
    get:
      operationId: listPlants
      summary: List all plants
      security:
        - api_key: []
      responses:
        "200":
          description: Array of plants
          schema:
            type: array
            items:
              $ref: "#/definitions/Plant"
    post:
      operationId: createPlant
      summary: Create a plant
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            $ref: "#/definitions/Plant"
      responses:
        "201":
          description: Created plant
          schema:
            $ref: "#/definitions/PlantWithId"
    options:
      operationId: corsPlants
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

  /plants/{plantId}:
    get:
      operationId: getPlant
      summary: Get a plant by ID
      security:
        - api_key: []
      parameters:
        - in: path
          name: plantId
          required: true
          type: string
      responses:
        "200":
          description: Plant
          schema:
            $ref: "#/definitions/PlantWithId"
        "404":
          description: Not found
    put:
      operationId: updatePlant
      summary: Update a plant
      security:
        - api_key: []
      parameters:
        - in: path
          name: plantId
          required: true
          type: string
        - in: body
          name: body
          required: true
          schema:
            $ref: "#/definitions/Plant"
      responses:
        "200":
          description: Updated plant
          schema:
            $ref: "#/definitions/PlantWithId"
        "404":
          description: Not found
    delete:
      operationId: deletePlant
      summary: Delete a plant
      security:
        - api_key: []
      parameters:
        - in: path
          name: plantId
          required: true
          type: string
      responses:
        "204":
          description: Deleted
        "404":
          description: Not found
    options:
      operationId: corsPlantById
      summary: CORS preflight
      parameters:
        - in: path
          name: plantId
          required: true
          type: string
      responses:
        "204":
          description: CORS preflight

  /analyse-floorplan:
    post:
      operationId: analyseFloorplan
      summary: Analyse a floorplan image with Gemini and return structured floor/room data
      x-google-backend:
        address: ${function_url}
        path_translation: APPEND_PATH_TO_ADDRESS
        jwt_audience: ${function_url}
        deadline: 110.0
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
            properties:
              imageBase64:
                type: string
              mimeType:
                type: string
      responses:
        "200":
          description: Analysed floor layout
          schema:
            type: object
            properties:
              floors:
                type: array
                items:
                  $ref: "#/definitions/Floor"
    options:
      operationId: corsAnalyseFloorplan
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

  /analyse:
    post:
      operationId: analysePlant
      summary: Analyse a plant photo with Gemini
      x-google-backend:
        address: ${function_url}
        path_translation: APPEND_PATH_TO_ADDRESS
        jwt_audience: ${function_url}
        deadline: 110.0
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
            properties:
              imageBase64:
                type: string
              mimeType:
                type: string
      responses:
        "200":
          description: Analysis result
          schema:
            type: object
            properties:
              species:
                type: string
              frequencyDays:
                type: integer
              health:
                type: string
              healthReason:
                type: string
              maturity:
                type: string
              recommendations:
                type: array
                items:
                  type: string
    options:
      operationId: corsAnalyse
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

  /images/upload-url:
    post:
      operationId: getImageUploadUrl
      summary: Get a signed URL to upload an image directly to GCS
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
            properties:
              filename:
                type: string
              contentType:
                type: string
      responses:
        "200":
          description: Signed upload URL and resulting public URL
          schema:
            type: object
            properties:
              uploadUrl:
                type: string
              publicUrl:
                type: string
    options:
      operationId: corsImageUploadUrl
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

  /config/floors:
    get:
      operationId: getFloors
      summary: Get floors configuration
      security:
        - api_key: []
      responses:
        "200":
          description: Floors config
          schema:
            type: object
            properties:
              floors:
                type: array
                items:
                  $ref: "#/definitions/Floor"
    put:
      operationId: saveFloors
      summary: Save floors configuration
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
            properties:
              floors:
                type: array
                items:
                  $ref: "#/definitions/Floor"
      responses:
        "200":
          description: Saved
    options:
      operationId: corsConfigFloors
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

  /config/floorplan:
    get:
      operationId: getFloorplan
      summary: Get the saved floorplan image URL
      security:
        - api_key: []
      responses:
        "200":
          description: Floorplan config
          schema:
            type: object
            properties:
              imageUrl:
                type: string
    put:
      operationId: saveFloorplan
      summary: Save the floorplan image URL
      security:
        - api_key: []
      parameters:
        - in: body
          name: body
          required: true
          schema:
            type: object
            properties:
              imageUrl:
                type: string
      responses:
        "200":
          description: Saved
    options:
      operationId: corsConfigFloorplan
      summary: CORS preflight
      responses:
        "204":
          description: CORS preflight

definitions:
  Plant:
    type: object
    properties:
      name:
        type: string
      species:
        type: string
      room:
        type: string
      x:
        type: number
        format: float
      y:
        type: number
        format: float
      lastWatered:
        type: string
      frequencyDays:
        type: integer
      notes:
        type: string
      health:
        type: string
      maturity:
        type: string
      recommendations:
        type: array
        items:
          type: string
      imageUrl:
        type: string
  Floor:
    type: object
    properties:
      id:
        type: string
      name:
        type: string
      order:
        type: integer
      type:
        type: string
      imageUrl:
        type: string
  PlantWithId:
    allOf:
      - $ref: "#/definitions/Plant"
      - type: object
        properties:
          id:
            type: string
          createdAt:
            type: string
          updatedAt:
            type: string
