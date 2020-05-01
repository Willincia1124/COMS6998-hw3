import json
from elasticsearch import Elasticsearch, RequestsHttpConnection
import requests
from requests_aws4auth import AWS4Auth
import boto3
import json
import uuid
import datetime
import math

def detect_labels(photo, bucket):
    response = boto3.client('rekognition').detect_labels(
    Image={
        'S3Object': {
            'Bucket': str(bucket),
            'Name': str(photo),
        }
    },
    MaxLabels=20,
    MinConfidence=70
    )
    print("rek response = ", json.dumps(response, indent=2))
    return [label['Name'].lower() for label in response['Labels']]


def lambda_handler(event, context):
    # print("event = ", json.dumps(event, indent=2))
    records = event["Records"]
    for record in records:
        s3 = record["s3"]
        photo = s3["object"]["key"]
        bucket = s3["bucket"]["name"]
    label_list = detect_labels(photo, bucket)
    print("Labels detected: ", str(label_list))

    # ES config.
    host = 'vpc-photos-h2eftiggwpqnswz52rtq7s4b54.us-east-1.es.amazonaws.com'
    region = 'us-east-1'
    service = 'es'
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, service, session_token=credentials.token)

    es = Elasticsearch(
        hosts=[{'host': host, 'port': 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )
    print("\nes_info = ", es.info())

    # index photo
    document = {
        "objectKey": photo,
        "bucket": bucket,
        "createdTimestamp": str(datetime.datetime.now()),
        "labels": label_list
    }
    print("\ndocument = ", json.dumps(document, indent=2))
    es.index(index="photos", doc_type="_doc", id=uuid.uuid4(), body=document)

    return {
        'statusCode': 200,
        'body': json.dumps('Hello from Lambda!')
    }
