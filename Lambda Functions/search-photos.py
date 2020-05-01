import json
import requests
import boto3
import math
import string

ES_URL = "https://vpc-photos-h2eftiggwpqnswz52rtq7s4b54.us-east-1.es.amazonaws.com"
AWS_S3_URL = "https://ccc-assignment3-b2.s3.amazonaws.com/"
ES_INDEX = '/photos'
cors_header = {"Access-Control-Allow-Origin": "*","Content-type": "application/json"}

def search(keyword):

    headers = { "Content-type": "application/json" }
    headers.update(cors_header);
    
    search_url = ES_URL + ES_INDEX + '/_search?q=' + keyword
    print(search_url)
    
    response = requests.get(search_url, headers = headers)
    
    r = response.text
    r_json = json.loads(r)
    hits = r_json['hits']['hits']

    if hits == []:
        return 'No such photos found.'
    else:
        photo_url = []
        for photo in hits:
            photo_url.append(AWS_S3_URL + photo['_source']['objectKey'])
        return photo_url


def lambda_handler(event, context):
    print('event is: {event}'.format(event=json.dumps(event, indent=4)))
    print('context is: {context}'.format(context=context))
    
    item = event['queryStringParameters']['q']
    print('text: {t}'.format(t=item))
    
    inputText = 'show me pictures with {first} in them'.format(first=item)
    
    client = boto3.client('lex-runtime')
    
    print("sending to lex.....")
    response = client.post_text(
        botName='search_photo',
        botAlias='search_bot',
        userId='test',
        inputText=inputText,
    )
    print("send to lex successfully!")
    print("lex response: {response}".format(response=json.dumps(response, indent=4)))
    
    first = response['slots']['First']
    second = response['slots']['Second']
    
    print("first = {first}; second = {second}".format(first=first, second=second))
    
    photo1 = json.dumps({
      "url" : search(first),
      "labels" : [{"items" : first}]
    })
    
    if second is None:
      message = {
        "results" : {
          "items" : 
            [photo1]
        }
      }
      
    else:
      photo2 = json.dumps({
        "url" : search(second),
        "labels" : [{"items" : second}]
      })

      message = {
        "results" : {
          "items" : 
            [photo1, photo2]
        }
      }
      
    return { 'statusCode': 200, 'body': json.dumps(message) , 'headers':cors_header}
    