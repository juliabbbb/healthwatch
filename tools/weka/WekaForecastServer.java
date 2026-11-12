import java.io.*;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import weka.core.*;
import weka.classifiers.trees.RandomForest;

public class WekaForecastServer {
  static void writeArff(Instances data,String path)throws Exception {
    StringBuilder b=new StringBuilder(new Instances(data,0).toString());
    for(int i=0;i<data.numInstances();i++){b.append("\n");for(int j=0;j<data.numAttributes();j++){if(j>0)b.append(',');b.append(data.instance(i).isMissing(j)?"?":Double.toString(data.instance(i).value(j)));}}
    Files.writeString(Path.of(path),b.toString());
  }
  static double median(ArrayList<Double> v) { Collections.sort(v); int n=v.size(); return n==0?0:(n%2==1?v.get(n/2):(v.get(n/2-1)+v.get(n/2))/2); }
  static double past(ArrayList<Double> h,ArrayList<LocalDate> dates,int index) {
    if(index>=0 && Double.isFinite(h.get(index))) return h.get(index);
    int m=dates.get(index).getMonthValue(); ArrayList<Double> same=new ArrayList<>(),all=new ArrayList<>();
    for(int k=0;k<h.size();k++) if(Double.isFinite(h.get(k))) { all.add(h.get(k)); if(dates.get(k).getMonthValue()==m) same.add(h.get(k)); }
    return median(same.size()>0?same:all);
  }
  static double[] features(ArrayList<Double> h,ArrayList<LocalDate> dates,LocalDate target) {
    int n=h.size(); double[] x=new double[12];int j=0;
    for(int lag:new int[]{1,2,3,6,12})x[j++]=past(h,dates,n-lag);
    for(int span:new int[]{3,6}) {double sum=0;for(int k=1;k<=span;k++)sum+=past(h,dates,n-k);x[j++]=sum/span;}
    int m=target.getMonthValue();x[j++]=Math.sin(2*Math.PI*m/12);x[j++]=Math.cos(2*Math.PI*m/12);x[j++]=(m>=6&&m<=11)?1:0;x[j++]=n;x[11]=Utils.missingValue();return x;
  }
  static void job(String input,String output,String trainArff,String testArff) throws Exception {
    ArrayList<Double> h=new ArrayList<>();ArrayList<LocalDate> dates=new ArrayList<>();
    for(String line:Files.readAllLines(Path.of(input)).subList(1,Files.readAllLines(Path.of(input)).size())) {
      String[] s=line.split(",",-1);dates.add(LocalDate.parse(s[0]));h.add(s[1].isEmpty()?Double.NaN:Double.parseDouble(s[1]));
    }
    String[] names={"lag1","lag2","lag3","lag6","lag12","mean3","mean6","month_sin","month_cos","wet","time_index","cases"};
    ArrayList<Attribute> attrs=new ArrayList<>();for(String n:names)attrs.add(new Attribute(n));
    Instances train=new Instances("HealthWatch_past_only",attrs,0);train.setClassIndex(11);
    for(int i=12;i<h.size();i++) if(Double.isFinite(h.get(i))) {
      double[] x=features(new ArrayList<>(h.subList(0,i)),new ArrayList<>(dates.subList(0,i)),dates.get(i));x[11]=h.get(i);train.add(new DenseInstance(1.0,x));
    }
    if(train.numInstances()<12)throw new Exception("Too few observed targets with lag history: "+train.numInstances());
    RandomForest rf=new RandomForest();rf.setOptions(new String[]{"-I","200","-depth","8","-M","2","-S","2026","-num-slots","1"});rf.buildClassifier(train);
    writeArff(train,trainArff);Instances test=new Instances(train,0);
    StringBuilder out=new StringBuilder("target_date,yhat\n");LocalDate anchor=dates.get(dates.size()-1);
    for(int step=1;step<=12;step++) {LocalDate d=anchor.plusMonths(step);double[] x=features(h,dates,d);DenseInstance v=new DenseInstance(1.0,x);v.setDataset(train);double pred=Math.max(0,rf.classifyInstance(v));test.add(v);out.append(d).append(",").append(pred).append("\n");h.add(pred);dates.add(d);}
    writeArff(test,testArff);Files.writeString(Path.of(output),out.toString());
  }
  public static void main(String[] args)throws Exception {
    BufferedReader r=new BufferedReader(new InputStreamReader(System.in));String line;System.out.println("READY|WEKA "+weka.core.Version.VERSION);System.out.flush();
    while((line=r.readLine())!=null) {if(line.equals("STOP"))break;try{String[] p=line.split("\t",-1);job(p[0],p[1],p[2],p[3]);System.out.println("DONE|"+p[1]);}catch(Exception e){e.printStackTrace(System.err);System.out.println("ERROR|"+e.toString());}System.out.flush();}
  }
}
